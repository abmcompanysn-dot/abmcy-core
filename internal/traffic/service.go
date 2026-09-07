// Package traffic aggregates internal/middleware's request_logs into the
// summaries the super-admin dashboard's traffic view needs: per-tenant
// request counts, error rates, and rate-limit hits over a time window.
package traffic

import (
	"context"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/google/uuid"
)

type Service struct {
	pool *db.Pool
}

func NewService(pool *db.Pool) *Service {
	return &Service{pool: pool}
}

type TenantSummary struct {
	TenantID         uuid.UUID `json:"tenant_id"`
	TenantSlug       string    `json:"tenant_slug"`
	RequestCount     int64     `json:"request_count"`
	ErrorCount       int64     `json:"error_count"` // status >= 500
	RateLimitedCount int64     `json:"rate_limited_count"`
}

// SummaryLast24h returns, per tenant, the request volume over the last 24
// hours — the main table on the dashboard's traffic page.
func (s *Service) SummaryLast24h(ctx context.Context) ([]TenantSummary, error) {
	var out []TenantSummary
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT t.id, t.slug,
			       count(rl.id) AS request_count,
			       count(*) FILTER (WHERE rl.status_code >= 500) AS error_count,
			       count(*) FILTER (WHERE rl.rate_limited) AS rate_limited_count
			FROM tenants t
			LEFT JOIN request_logs rl
			       ON rl.tenant_id = t.id AND rl.created_at > now() - interval '24 hours'
			GROUP BY t.id, t.slug
			ORDER BY request_count DESC
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var ts TenantSummary
			if err := rows.Scan(&ts.TenantID, &ts.TenantSlug, &ts.RequestCount, &ts.ErrorCount, &ts.RateLimitedCount); err != nil {
				return err
			}
			out = append(out, ts)
		}
		return rows.Err()
	})
	return out, err
}

type RecentRequest struct {
	Method      string    `json:"method"`
	Path        string    `json:"path"`
	StatusCode  int       `json:"status_code"`
	DurationMs  int       `json:"duration_ms"`
	RateLimited bool      `json:"rate_limited"`
	CreatedAt   time.Time `json:"created_at"`
}

// RecentForTenant returns the most recent requests for one tenant — used
// when an admin drills into a single tenant's traffic detail.
func (s *Service) RecentForTenant(ctx context.Context, tenantID uuid.UUID, limit int) ([]RecentRequest, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var out []RecentRequest
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT method, path, status_code, duration_ms, rate_limited, created_at
			FROM request_logs
			WHERE tenant_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		`, tenantID, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var rr RecentRequest
			if err := rows.Scan(&rr.Method, &rr.Path, &rr.StatusCode, &rr.DurationMs, &rr.RateLimited, &rr.CreatedAt); err != nil {
				return err
			}
			out = append(out, rr)
		}
		return rows.Err()
	})
	return out, err
}

// PurgeOlderThan deletes request_logs rows past the given age, keeping the
// table from growing unbounded. Intended to run from a periodic job (see
// k8s/README.md for adding a CronJob) — not wired to a schedule yet.
func (s *Service) PurgeOlderThan(ctx context.Context, age time.Duration) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `DELETE FROM request_logs WHERE created_at < now() - $1::interval`, age.String())
		return err
	})
}
