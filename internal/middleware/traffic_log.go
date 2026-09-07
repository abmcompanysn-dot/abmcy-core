package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/google/uuid"
)

type rateLimitedFlag struct{ hit bool }

type rateLimitedCtxKey struct{}

// MarkRateLimited flags the in-flight request as rejected by RateLimit, so
// TrafficLog can record it accurately even though the handler chain never
// reaches the actual route.
func MarkRateLimited(r *http.Request) {
	if f, ok := r.Context().Value(rateLimitedCtxKey{}).(*rateLimitedFlag); ok {
		f.hit = true
	}
}

// statusRecorder captures the status code a downstream handler wrote,
// since http.ResponseWriter doesn't expose it after the fact.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (w *statusRecorder) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

// TrafficLog records one row per request into request_logs — the raw
// material behind the super-admin dashboard's traffic view (requests per
// tenant, error rates, rate-limit hits). Writes happen fire-and-forget on
// a background goroutine so logging never adds latency to the response,
// and a logging failure never breaks the request it's describing.
//
// Must run AFTER TenantAuth (so tenant context is available) and BEFORE
// RateLimit is where it matters least — in practice it wraps the whole
// tenant-scoped route group so it also captures rate-limited requests.
func TrafficLog(pool *db.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			flag := &rateLimitedFlag{}
			ctx := context.WithValue(r.Context(), rateLimitedCtxKey{}, flag)
			r = r.WithContext(ctx)

			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			start := time.Now()

			next.ServeHTTP(rec, r)

			duration := time.Since(start)
			var tenantID *uuid.UUID
			if t, ok := TenantFromContext(r.Context()); ok {
				tenantID = &t.ID
			}

			go func() {
				logCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = pool.WithSystem(logCtx, func(ctx context.Context, tx db.TxLike) error {
					_, err := tx.Exec(ctx, `
						INSERT INTO request_logs (tenant_id, method, path, status_code, duration_ms, rate_limited)
						VALUES ($1, $2, $3, $4, $5, $6)
					`, tenantID, r.Method, r.URL.Path, rec.status, duration.Milliseconds(), flag.hit)
					return err
				})
			}()
		})
	}
}
