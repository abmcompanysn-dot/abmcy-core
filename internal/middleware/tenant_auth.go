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
// after successful authentication — either by X-API-Key (external
// integrations, e.g. a tenant's own website) or by a staff JWT (a human
// logged into the tenant dashboard). StaffUserID/StaffRole are only set
// in the latter case.
type Tenant struct {
	ID              uuid.UUID
	Slug            string
	Plan            string
	Active          bool
	RateLimitPerSec int
	RateLimitBurst  int
	StaffUserID     *uuid.UUID
	StaffRole       string
}

func TenantFromContext(ctx context.Context) (Tenant, bool) {
	t, ok := ctx.Value(tenantCtxKey).(Tenant)
	return t, ok
}

// WithTenant attaches Tenant to ctx the same way TenantAuth does — used
// by httpserver.staffAuth to inject the tenant resolved from a staff JWT
// (rather than from an X-API-Key lookup) into the request context.
func WithTenant(ctx context.Context, t Tenant) context.Context {
	return context.WithValue(ctx, tenantCtxKey, t)
}

// LookupByID resolves a Tenant by its ID rather than by API key — used by
// staffAuth once a JWT's tenant_id claim has been verified, since at that
// point there's no API key to look up by.
func LookupByID(ctx context.Context, pool *db.Pool, tenantID uuid.UUID) (Tenant, error) {
	var t Tenant
	err := pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx,
			`SELECT id, slug, plan, is_active, rate_limit_per_sec, rate_limit_burst FROM tenants WHERE id = $1`,
			tenantID,
		)
		return row.Scan(&t.ID, &t.Slug, &t.Plan, &t.Active, &t.RateLimitPerSec, &t.RateLimitBurst)
	})
	return t, err
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
