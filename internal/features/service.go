// Package features gates optional tenant capabilities — the storefront
// catalog's five independent services (products, fabrics, cart, gallery,
// reviews) — behind per-service, per-tenant switches set from the
// super-admin dashboard. A tenant doing couture sur-mesure typically wants
// a product showcase, a fabric gallery and reviews but no classic
// e-commerce cart (orders go through the dedicated custom-order flow
// instead); a general retailer wants products and a cart but no fabric
// gallery. Splitting these apart — rather than one all-or-nothing
// catalog_enabled flag — lets each tenant's dashboard and public routes
// match what they actually sell.
package features

import (
	"context"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/tenant"
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
	ProductsEnabled bool `json:"products_enabled"`
	FabricsEnabled  bool `json:"fabrics_enabled"`
	CartEnabled     bool `json:"cart_enabled"`
	GalleryEnabled  bool `json:"gallery_enabled"`
	ReviewsEnabled  bool `json:"reviews_enabled"`
	// StaffEnabled gates team management (GET/POST /staff, PUT
	// /staff/{id}/active) — unlike the five catalog services above, this
	// has nothing to do with what a tenant sells; it's about whether ABMCY
	// has provisioned multi-account access for that tenant's team. Off by
	// default like every other service, not part of any business_type
	// preset (see PresetFor) since it's orthogonal to the storefront.
	StaffEnabled bool `json:"staff_enabled"`
	// ContentEnabled gates the editorial article service (internal/content)
	// — a media tenant (tenant.BusinessMedia) publishing news articles
	// rather than selling products. Independent of the five catalog flags
	// above since a tenant can be media-only, storefront-only, or both.
	ContentEnabled bool `json:"content_enabled"`
}

// PresetFor returns the default flag combination suggested for a business
// type — applied once at tenant creation (see tenant.Service.Create). An
// operator can still change any flag afterwards from the admin dashboard;
// this only saves the first, most common setup from being clicked through
// manually every time.
func PresetFor(businessType string) Flags {
	switch tenant.BusinessType(businessType) {
	case tenant.BusinessCouture:
		// Custom orders (measurements, fabric choice) go through the
		// dedicated /custom-orders flow, not a classic cart.
		return Flags{ProductsEnabled: true, FabricsEnabled: true, GalleryEnabled: true, ReviewsEnabled: true}
	case tenant.BusinessGeneral, tenant.BusinessDigital:
		return Flags{ProductsEnabled: true, CartEnabled: true, ReviewsEnabled: true}
	case tenant.BusinessMedia:
		return Flags{ContentEnabled: true}
	default:
		return Flags{}
	}
}

// Get returns a tenant's feature flags, defaulting to all-disabled if the
// tenant has no tenant_features row yet (e.g. created before this table
// existed, or never explicitly configured).
func (s *Service) Get(ctx context.Context, tenantID uuid.UUID) (Flags, error) {
	var f Flags
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			SELECT products_enabled, fabrics_enabled, cart_enabled, gallery_enabled, reviews_enabled, staff_enabled, content_enabled
			FROM tenant_features WHERE tenant_id = $1
		`, tenantID)
		err := row.Scan(&f.ProductsEnabled, &f.FabricsEnabled, &f.CartEnabled, &f.GalleryEnabled, &f.ReviewsEnabled, &f.StaffEnabled, &f.ContentEnabled)
		if err != nil {
			// No row yet: everything stays disabled by default, not an error.
			f = Flags{}
			return nil
		}
		return nil
	})
	if err != nil {
		return Flags{}, fmt.Errorf("features: get: %w", err)
	}
	return f, nil
}

// Set replaces a tenant's feature flags wholesale — simpler than per-field
// PATCH semantics for a struct this small, and matches how the admin
// dashboard's features form already submits (all 5 checkboxes at once).
func (s *Service) Set(ctx context.Context, tenantID uuid.UUID, f Flags) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO tenant_features (tenant_id, products_enabled, fabrics_enabled, cart_enabled, gallery_enabled, reviews_enabled, staff_enabled, content_enabled, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
			ON CONFLICT (tenant_id) DO UPDATE SET
				products_enabled = $2, fabrics_enabled = $3, cart_enabled = $4,
				gallery_enabled = $5, reviews_enabled = $6, staff_enabled = $7, content_enabled = $8, updated_at = now()
		`, tenantID, f.ProductsEnabled, f.FabricsEnabled, f.CartEnabled, f.GalleryEnabled, f.ReviewsEnabled, f.StaffEnabled, f.ContentEnabled)
		return err
	})
}

// ApplyPreset seeds a freshly created tenant's flags from PresetFor —
// called once at tenant.Service.Create time so a new tenant isn't stuck
// with every catalog service disabled until an operator manually visits
// the features page.
func (s *Service) ApplyPreset(ctx context.Context, tenantID uuid.UUID, businessType string) error {
	return s.Set(ctx, tenantID, PresetFor(businessType))
}

var errNames = map[string]string{
	"products": "produits",
	"fabrics":  "tissus",
	"cart":     "panier",
	"gallery":  "galerie",
	"reviews":  "avis",
	"staff":    "gestion d'équipe",
	"content":  "articles",
}

func notEnabledError(service string) error {
	label := errNames[service]
	return apierror.New(403, service+"_not_enabled",
		fmt.Sprintf("Le service %s n'est pas activé pour ce compte. Contactez ABMCY pour l'activer.", label))
}

// RequireProducts, RequireFabrics, RequireCart, RequireGallery and
// RequireReviews are called by their respective handlers before doing any
// work, so a tenant without that specific service enabled gets a clear,
// consistent error instead of the feature silently working or
// half-working — mirrors the old single RequireCatalog, one gate per
// service instead of one gate for all five.
func (s *Service) RequireProducts(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.ProductsEnabled {
		return notEnabledError("products")
	}
	return nil
}

func (s *Service) RequireFabrics(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.FabricsEnabled {
		return notEnabledError("fabrics")
	}
	return nil
}

func (s *Service) RequireCart(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.CartEnabled {
		return notEnabledError("cart")
	}
	return nil
}

func (s *Service) RequireGallery(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.GalleryEnabled {
		return notEnabledError("gallery")
	}
	return nil
}

func (s *Service) RequireReviews(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.ReviewsEnabled {
		return notEnabledError("reviews")
	}
	return nil
}

func (s *Service) RequireStaff(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.StaffEnabled {
		return notEnabledError("staff")
	}
	return nil
}

func (s *Service) RequireContent(ctx context.Context, tenantID uuid.UUID) error {
	f, err := s.Get(ctx, tenantID)
	if err != nil {
		return err
	}
	if !f.ContentEnabled {
		return notEnabledError("content")
	}
	return nil
}
