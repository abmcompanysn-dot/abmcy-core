package tenant

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Tenant struct {
	ID                uuid.UUID `json:"id"`
	Name              string    `json:"name"`
	Slug              string    `json:"slug"`
	APIKeyPublic      string    `json:"api_key_public"`
	Plan              string    `json:"plan"`
	StorageLimitBytes int64     `json:"storage_limit_bytes"`
	StorageUsedBytes  int64     `json:"storage_used_bytes"`
	EmailQuotaPerDay  int       `json:"email_quota_per_day"`
	RateLimitPerSec   int       `json:"rate_limit_per_sec"`
	RateLimitBurst    int       `json:"rate_limit_burst"`
	IsActive          bool      `json:"is_active"`
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
// e.g. when a new client like HANI'S signs up). Runs outside RLS since
// no tenant context exists yet.
func (s *Service) Create(ctx context.Context, name, slug string) (*CreateResult, error) {
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
			INSERT INTO tenants (name, slug, api_key_public, api_key_secret_hash)
			VALUES ($1, $2, $3, $4)
			RETURNING id, name, slug, api_key_public, plan, storage_limit_bytes, storage_used_bytes, email_quota_per_day, rate_limit_per_sec, rate_limit_burst, is_active
		`, name, slug, pubKey, string(secretHash))
		return row.Scan(&t.ID, &t.Name, &t.Slug, &t.APIKeyPublic, &t.Plan,
			&t.StorageLimitBytes, &t.StorageUsedBytes, &t.EmailQuotaPerDay, &t.RateLimitPerSec, &t.RateLimitBurst, &t.IsActive)
	})
	if err != nil {
		return nil, fmt.Errorf("tenant: create: %w", err)
	}

	return &CreateResult{Tenant: t, APIKeySecret: secretKey}, nil
}

// ListAll is for the ABMCY super-admin dashboard: list every client,
// their plan, and their current storage consumption.
func (s *Service) ListAll(ctx context.Context) ([]Tenant, error) {
	var tenants []Tenant
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, name, slug, api_key_public, plan, storage_limit_bytes, storage_used_bytes, email_quota_per_day, rate_limit_per_sec, rate_limit_burst, is_active
			FROM tenants ORDER BY created_at DESC
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var t Tenant
			if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.APIKeyPublic, &t.Plan,
				&t.StorageLimitBytes, &t.StorageUsedBytes, &t.EmailQuotaPerDay, &t.RateLimitPerSec, &t.RateLimitBurst, &t.IsActive); err != nil {
				return err
			}
			tenants = append(tenants, t)
		}
		return rows.Err()
	})
	return tenants, err
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

func randomKey(prefix string) (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(b), nil
}
