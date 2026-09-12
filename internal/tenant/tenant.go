package tenant

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// BusinessType hints at which shape of products.attributes the dashboard
// suggests by default for a tenant (sizes/colors for a tailor, a download
// link for a digital product, ...). It never restricts what a tenant can
// actually store — see internal/catalog/products.go.
type BusinessType string

const (
	BusinessCouture BusinessType = "couture_sur_mesure"
	BusinessGeneral BusinessType = "commerce_general"
	BusinessDigital BusinessType = "produit_numerique"
	BusinessMedia   BusinessType = "media"
	BusinessOther   BusinessType = "general"
)

func ValidBusinessType(bt string) bool {
	switch BusinessType(bt) {
	case BusinessCouture, BusinessGeneral, BusinessDigital, BusinessMedia, BusinessOther:
		return true
	}
	return false
}

type Tenant struct {
	ID                uuid.UUID `json:"id"`
	Name              string    `json:"name"`
	Slug              string    `json:"slug"`
	ContactEmail      string    `json:"contact_email,omitempty"`
	APIKeyPublic      string    `json:"api_key_public"`
	Plan              string    `json:"plan"`
	BusinessType      string    `json:"business_type"`
	StorageLimitBytes int64     `json:"storage_limit_bytes"`
	StorageUsedBytes  int64     `json:"storage_used_bytes"`
	EmailQuotaPerDay  int       `json:"email_quota_per_day"`
	RateLimitPerSec   int       `json:"rate_limit_per_sec"`
	RateLimitBurst    int       `json:"rate_limit_burst"`
	IsActive          bool      `json:"is_active"`

	// Profil public — ce qu'un tenant affiche sur son propre site/dashboard,
	// distinct de ce qui sert le fonctionnement interne de la plateforme
	// ci-dessus. Tous optionnels : un tenant peut fonctionner sans jamais
	// les renseigner.
	ContactName  string `json:"contact_name,omitempty"`
	ContactPhone string `json:"contact_phone,omitempty"`
	ContactRole  string `json:"contact_role,omitempty"`
	LogoURL      string `json:"logo_url,omitempty"`
	BrandColor   string `json:"brand_color,omitempty"`
	Tagline      string `json:"tagline,omitempty"`
	Language     string `json:"language"`
}

// Social is one social/contact link a tenant displays publicly (Instagram,
// TikTok, WhatsApp...). A tenant can have more than one of the same type —
// HANI'S has two WhatsApp numbers, for example — so this is its own table
// rather than a single column per platform.
type Social struct {
	ID       uuid.UUID `json:"id"`
	Type     string    `json:"type"`
	URL      string    `json:"url"`
	Position int       `json:"position"`
}

type Service struct {
	pool *db.Pool
}

func NewService(pool *db.Pool) *Service {
	return &Service{pool: pool}
}

// CreateResult carries the plaintext secret key back to the caller
// exactly once — it is never stored or retrievable again after this.
type CreateResult struct {
	Tenant       Tenant
	APIKeySecret string
}

// Create provisions a new tenant (called from the super-admin dashboard,
// e.g. when a new client like HANI'S signs up) AND its first staff
// account ("owner"), so someone can actually log into tenant-dashboard
// right away — without an owner row, login/password auth would have no
// account to authenticate against. ownerEmail/ownerPassword are required
// together; pass both empty to skip creating an owner (not recommended,
// but kept possible for scripts/tests that only need the API key).
func (s *Service) Create(ctx context.Context, name, slug, contactEmail, businessType, ownerEmail, ownerPassword string) (*CreateResult, error) {
	if businessType == "" {
		businessType = string(BusinessOther)
	}
	if !ValidBusinessType(businessType) {
		return nil, apierror.ErrValidation
	}
	if (ownerEmail == "") != (ownerPassword == "") {
		return nil, apierror.New(422, "validation_error", "L'email et le mot de passe du propriétaire doivent être fournis ensemble.")
	}
	if ownerPassword != "" && len(ownerPassword) < 8 {
		return nil, apierror.New(422, "validation_error", "Le mot de passe du propriétaire doit contenir au moins 8 caractères.")
	}

	pubKey, err := randomKey("pk_live_")
	if err != nil {
		return nil, apierror.ErrInternal
	}
	secretKey, err := randomKey("sk_live_")
	if err != nil {
		return nil, apierror.ErrInternal
	}
	secretHash, err := bcrypt.GenerateFromPassword([]byte(secretKey), bcrypt.DefaultCost)
	if err != nil {
		return nil, apierror.ErrInternal
	}

	var t Tenant
	err = s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO tenants (name, slug, contact_email, api_key_public, api_key_secret_hash, business_type)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, name, slug, coalesce(contact_email, ''), api_key_public, plan, business_type, storage_limit_bytes, storage_used_bytes, email_quota_per_day, rate_limit_per_sec, rate_limit_burst, is_active,
				coalesce(contact_name, ''), coalesce(contact_phone, ''), coalesce(contact_role, ''), coalesce(logo_url, ''), coalesce(brand_color, ''), coalesce(tagline, ''), language
		`, name, slug, contactEmail, pubKey, string(secretHash), businessType)
		return row.Scan(&t.ID, &t.Name, &t.Slug, &t.ContactEmail, &t.APIKeyPublic, &t.Plan, &t.BusinessType,
			&t.StorageLimitBytes, &t.StorageUsedBytes, &t.EmailQuotaPerDay, &t.RateLimitPerSec, &t.RateLimitBurst, &t.IsActive,
			&t.ContactName, &t.ContactPhone, &t.ContactRole, &t.LogoURL, &t.BrandColor, &t.Tagline, &t.Language)
	})
	if err != nil {
		return nil, fmt.Errorf("tenant: create: %w", err)
	}

	if ownerPassword != "" {
		ownerHash, err := bcrypt.GenerateFromPassword([]byte(ownerPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, apierror.ErrInternal
		}
		// Separate transaction from the tenant insert above: WithTenant
		// needs the tenant's own ID to set app.tenant_id for RLS, which
		// only exists once the INSERT into tenants has committed.
		err = s.pool.WithTenant(ctx, t.ID, func(ctx context.Context, tx db.TxLike) error {
			_, err := tx.Exec(ctx, `
				INSERT INTO users (tenant_id, email, password_hash, role)
				VALUES ($1, $2, $3, 'owner')
			`, t.ID, ownerEmail, string(ownerHash))
			return err
		})
		if err != nil {
			return nil, fmt.Errorf("tenant: create owner account: %w", err)
		}
	}

	return &CreateResult{Tenant: t, APIKeySecret: secretKey}, nil
}

// ListAll is for the ABMCY super-admin dashboard: list every client,
// their plan, and their current storage consumption.
func (s *Service) ListAll(ctx context.Context) ([]Tenant, error) {
	var tenants []Tenant
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, name, slug, coalesce(contact_email, ''), api_key_public, plan, business_type, storage_limit_bytes, storage_used_bytes, email_quota_per_day, rate_limit_per_sec, rate_limit_burst, is_active,
				coalesce(contact_name, ''), coalesce(contact_phone, ''), coalesce(contact_role, ''), coalesce(logo_url, ''), coalesce(brand_color, ''), coalesce(tagline, ''), language
			FROM tenants ORDER BY created_at DESC
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var t Tenant
			if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.ContactEmail, &t.APIKeyPublic, &t.Plan, &t.BusinessType,
				&t.StorageLimitBytes, &t.StorageUsedBytes, &t.EmailQuotaPerDay, &t.RateLimitPerSec, &t.RateLimitBurst, &t.IsActive,
				&t.ContactName, &t.ContactPhone, &t.ContactRole, &t.LogoURL, &t.BrandColor, &t.Tagline, &t.Language); err != nil {
				return err
			}
			tenants = append(tenants, t)
		}
		return rows.Err()
	})
	return tenants, err
}

// UpdateProfileInput mirrors catalog.UpdateProductInput's pattern: every
// field is a pointer, nil means "leave unchanged" (PATCH semantics).
type UpdateProfileInput struct {
	ContactEmail *string
	ContactName  *string
	ContactPhone *string
	ContactRole  *string
	LogoURL      *string
	BrandColor   *string
	Tagline      *string
	Language     *string
}

// UpdateProfile lets the super-admin dashboard (or, later, a tenant's own
// settings page) fill in the public-facing identity — logo, brand color,
// contact — that Create leaves empty by default.
func (s *Service) UpdateProfile(ctx context.Context, tenantID uuid.UUID, in UpdateProfileInput) (*Tenant, error) {
	var t Tenant
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE tenants SET
				contact_email = coalesce($9, contact_email),
				contact_name = coalesce($2, contact_name),
				contact_phone = coalesce($3, contact_phone),
				contact_role = coalesce($4, contact_role),
				logo_url = coalesce($5, logo_url),
				brand_color = coalesce($6, brand_color),
				tagline = coalesce($7, tagline),
				language = coalesce($8, language),
				updated_at = now()
			WHERE id = $1
			RETURNING id, name, slug, coalesce(contact_email, ''), api_key_public, plan, business_type, storage_limit_bytes, storage_used_bytes, email_quota_per_day, rate_limit_per_sec, rate_limit_burst, is_active,
				coalesce(contact_name, ''), coalesce(contact_phone, ''), coalesce(contact_role, ''), coalesce(logo_url, ''), coalesce(brand_color, ''), coalesce(tagline, ''), language
		`, tenantID, in.ContactName, in.ContactPhone, in.ContactRole, in.LogoURL, in.BrandColor, in.Tagline, in.Language, in.ContactEmail)
		if err := row.Scan(&t.ID, &t.Name, &t.Slug, &t.ContactEmail, &t.APIKeyPublic, &t.Plan, &t.BusinessType,
			&t.StorageLimitBytes, &t.StorageUsedBytes, &t.EmailQuotaPerDay, &t.RateLimitPerSec, &t.RateLimitBurst, &t.IsActive,
			&t.ContactName, &t.ContactPhone, &t.ContactRole, &t.LogoURL, &t.BrandColor, &t.Tagline, &t.Language); err != nil {
			return apierror.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListSocials returns a tenant's social/contact links, ordered for
// display (position, then insertion order).
func (s *Service) ListSocials(ctx context.Context, tenantID uuid.UUID) ([]Social, error) {
	var socials []Social
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, type, url, position FROM tenant_socials
			WHERE tenant_id = $1 ORDER BY position, created_at
		`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var soc Social
			if err := rows.Scan(&soc.ID, &soc.Type, &soc.URL, &soc.Position); err != nil {
				return err
			}
			socials = append(socials, soc)
		}
		return rows.Err()
	})
	return socials, err
}

// ReplaceSocials swaps a tenant's entire social link list for a new one —
// simpler and safer than diffing individual add/remove/reorder operations
// for what's normally a short, infrequently-edited list.
func (s *Service) ReplaceSocials(ctx context.Context, tenantID uuid.UUID, socials []Social) ([]Social, error) {
	var result []Social
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		if _, err := tx.Exec(ctx, `DELETE FROM tenant_socials WHERE tenant_id = $1`, tenantID); err != nil {
			return err
		}
		for i, soc := range socials {
			if soc.Type == "" || soc.URL == "" {
				return apierror.ErrValidation
			}
			var inserted Social
			row := tx.QueryRow(ctx, `
				INSERT INTO tenant_socials (tenant_id, type, url, position)
				VALUES ($1, $2, $3, $4)
				RETURNING id, type, url, position
			`, tenantID, soc.Type, soc.URL, i)
			if err := row.Scan(&inserted.ID, &inserted.Type, &inserted.URL, &inserted.Position); err != nil {
				return err
			}
			result = append(result, inserted)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("tenant: replace socials: %w", err)
	}
	return result, nil
}

// UpdateQuota lets the super-admin adjust a tenant's storage limit —
// e.g. after they upgrade their subscription plan.
func (s *Service) UpdateQuota(ctx context.Context, tenantID uuid.UUID, limitBytes int64) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `UPDATE tenants SET storage_limit_bytes = $1, updated_at = now() WHERE id = $2`, limitBytes, tenantID)
		return err
	})
}

// UpdateRateLimit lets the super-admin adjust a tenant's request-rate
// allowance (requests/sec sustained + burst) — e.g. to grant a paying
// tenant more headroom than the free-plan default.
func (s *Service) UpdateRateLimit(ctx context.Context, tenantID uuid.UUID, perSec, burst int) error {
	if perSec <= 0 || burst <= 0 {
		return apierror.ErrValidation
	}
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `UPDATE tenants SET rate_limit_per_sec = $1, rate_limit_burst = $2, updated_at = now() WHERE id = $3`,
			perSec, burst, tenantID)
		return err
	})
}

// UpdateBusinessType lets the super-admin correct or change a tenant's
// business type after creation (e.g. HANI'S starts as "general" and later
// gets recognized as "couture_sur_mesure" once the catalog is set up).
func (s *Service) UpdateBusinessType(ctx context.Context, tenantID uuid.UUID, businessType string) error {
	if !ValidBusinessType(businessType) {
		return apierror.ErrValidation
	}
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `UPDATE tenants SET business_type = $1, updated_at = now() WHERE id = $2`, businessType, tenantID)
		return err
	})
}

// SetActive lets the super-admin suspend or reinstate a tenant (e.g. a
// client stops paying, or a dispute needs the account frozen) without
// deleting anything. Enforcement already exists on the read side:
// middleware.TenantAuth rejects an X-API-Key request once is_active is
// false, and the staff-JWT path in httpserver checks LookupByID(...).Active
// the same way — so flipping this flag immediately locks the tenant's own
// staff and integrations out, with no other change required.
func (s *Service) SetActive(ctx context.Context, tenantID uuid.UUID, active bool) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `UPDATE tenants SET is_active = $1, updated_at = now() WHERE id = $2`, active, tenantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}

// RegenerateAPIKeys issues a fresh public/secret key pair for an existing
// tenant (e.g. the old key leaked, or a staff member left). The old
// api_key_public stops authenticating the moment this commits, since
// middleware.TenantAuth looks tenants up by that exact value. Like
// Create, the plaintext secret is returned once and never stored.
func (s *Service) RegenerateAPIKeys(ctx context.Context, tenantID uuid.UUID) (*CreateResult, error) {
	pubKey, err := randomKey("pk_live_")
	if err != nil {
		return nil, apierror.ErrInternal
	}
	secretKey, err := randomKey("sk_live_")
	if err != nil {
		return nil, apierror.ErrInternal
	}
	secretHash, err := bcrypt.GenerateFromPassword([]byte(secretKey), bcrypt.DefaultCost)
	if err != nil {
		return nil, apierror.ErrInternal
	}

	var t Tenant
	err = s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE tenants SET api_key_public = $1, api_key_secret_hash = $2, updated_at = now()
			WHERE id = $3
			RETURNING id, name, slug, coalesce(contact_email, ''), api_key_public, plan, business_type, storage_limit_bytes, storage_used_bytes, email_quota_per_day, rate_limit_per_sec, rate_limit_burst, is_active,
				coalesce(contact_name, ''), coalesce(contact_phone, ''), coalesce(contact_role, ''), coalesce(logo_url, ''), coalesce(brand_color, ''), coalesce(tagline, ''), language
		`, pubKey, string(secretHash), tenantID)
		return row.Scan(&t.ID, &t.Name, &t.Slug, &t.ContactEmail, &t.APIKeyPublic, &t.Plan, &t.BusinessType,
			&t.StorageLimitBytes, &t.StorageUsedBytes, &t.EmailQuotaPerDay, &t.RateLimitPerSec, &t.RateLimitBurst, &t.IsActive,
			&t.ContactName, &t.ContactPhone, &t.ContactRole, &t.LogoURL, &t.BrandColor, &t.Tagline, &t.Language)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apierror.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("tenant: regenerate api keys: %w", err)
	}
	return &CreateResult{Tenant: t, APIKeySecret: secretKey}, nil
}

// Delete permanently removes a tenant and, via ON DELETE CASCADE on every
// table that references tenants(id), all of its data (orders, products,
// customers, staff users, request logs, etc.). Irreversible — the caller
// is responsible for confirming intent.
func (s *Service) Delete(ctx context.Context, tenantID uuid.UUID) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, tenantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}

func randomKey(prefix string) (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(b), nil
}
