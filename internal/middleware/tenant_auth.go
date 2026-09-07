package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"github.com/google/uuid"
)

type ctxKey string

const tenantCtxKey ctxKey = "tenant"

// Tenant is the minimal tenant info attached to the request context
// after successful API key authentication.
type Tenant struct {
	ID              uuid.UUID
	Slug            string
	Plan            string
	Active          bool
	RateLimitPerSec int
	RateLimitBurst  int
}

func TenantFromContext(ctx context.Context) (Tenant, bool) {
	t, ok := ctx.Value(tenantCtxKey).(Tenant)
	return t, ok
}

// TenantAuth identifies the calling tenant from the X-API-Key header
// (or "Authorization: Bearer pk_live_...") and attaches it to the
// request context. It looks up tenants via WithSystem since, at this
// point, we don't yet know which tenant's RLS context to use.
func TenantAuth(pool *db.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
					apiKey = strings.TrimPrefix(auth, "Bearer ")
				}
			}
			if apiKey == "" {
				response.Err(w, apierror.ErrMissingAPIKey)
				return
			}

			var t Tenant
			err := pool.WithSystem(r.Context(), func(ctx context.Context, tx db.TxLike) error {
				row := tx.QueryRow(ctx,
					`SELECT id, slug, plan, is_active, rate_limit_per_sec, rate_limit_burst FROM tenants WHERE api_key_public = $1`,
					apiKey,
				)
				return row.Scan(&t.ID, &t.Slug, &t.Plan, &t.Active, &t.RateLimitPerSec, &t.RateLimitBurst)
			})
			if err != nil {
				response.Err(w, apierror.ErrInvalidAPIKey)
				return
			}
			if !t.Active {
				response.Err(w, apierror.ErrInvalidAPIKey)
				return
			}

			ctx := context.WithValue(r.Context(), tenantCtxKey, t)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
