// Package features gates optional tenant capabilities — right now just the
// storefront catalog (products, fabrics, cart, gallery, reviews) — behind
// a per-tenant on/off switch set from the super-admin dashboard. A tenant
// who sells entirely over WhatsApp or in-store may only need custom
// orders, not a public catalog; this keeps that catalog surface fully
// opt-in instead of always-on for every tenant.
package features

import (
	"context"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Service struct {
	pool *db.Pool
}

func NewService(pool *db.Pool) *Service {
	return &Service{pool: pool}
}

type Flags struct {
	CatalogEnabled bool `json:"catalog_enabled"`
}

// Get returns a tenant's feature flags, defaulting to all-disabled if the
// tenant has no tenant_features row yet (e.g. created before this table
// existed, or never explicitly configured).
func (s *Service) Get(ctx context.Context, tenantID uuid.UUID) (Flags, error) {
	var f Flags
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `SELECT catalog_enabled FROM tenant_features WHERE tenant_id = $1`, tenantID)
		err := row.Scan(&f.CatalogEnabled)
		if err != nil {
			// No row yet: catalog stays disabled by default, not an error.
			f.CatalogEnabled = false
			return nil
		}
		return nil
	})
	if err != nil {
		return Flags{}, fmt.Errorf("features: get: %w", err)
	}
	return f, nil
}

// SetCatalogEnabled toggles the catalog feature for a tenant — called from
// the super-admin dashboard's tenant detail page.
func (s *Service) SetCatalogEnabled(ctx context.Context, tenantID uuid.UUID, enabled bool) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO tenant_features (tenant_id, catalog_enabled, updated_at)
			VALUES ($1, $2, now())
			ON CONFLICT (tenant_id) DO UPDATE SET catalog_enabled = $2, updated_at = now()
		`, tenantID, enabled)
		return err
	})
}

// RequireCatalog is called by every catalog handler before doing any work,
// so a tenant without the feature enabled gets a clear, consistent error
// instead of the catalog silently working or half-working.
func (s *Service) RequireCatalog(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.CatalogEnabled {
		return apierror.New(403, "catalog_not_enabled",
			"Le service catalogue n'est pas activé pour ce compte. Contactez ABMCY pour l'activer.")
	}
	return nil
}
