// Package tenantpayment stores each tenant's own ABMCY Core Payment
// credentials (app_key + hmac_secret), encrypted at rest, and builds a
// signed client from them. Unlike the old CinetPay setup, credentials are
// per-tenant: every tenant creates its own application in the ABMCY Core
// Payment console and gets paid on its own account.
package tenantpayment

import (
	"context"
	"errors"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

// ErrNotConfigured is returned when a tenant has no ABMCY Core Payment
// credentials yet — the caller turns this into a clear 503.
var ErrNotConfigured = errors.New("tenantpayment: not configured for this tenant")

type Service struct {
	pool    *db.Pool
	cryptor *platformconfig.Cryptor
	baseURL string
}

// NewService wires the store. base64EncryptionKey is the same
// CONFIG_ENCRYPTION_KEY used by platformconfig. baseURL is the ABMCY Core
// Payment API root (e.g. https://core.diarra.app).
func NewService(pool *db.Pool, base64EncryptionKey, baseURL string) (*Service, error) {
	c, err := platformconfig.NewCryptor(base64EncryptionKey)
	if err != nil {
		return nil, err
	}
	return &Service{pool: pool, cryptor: c, baseURL: baseURL}, nil
}

// Set stores (or replaces) a tenant's credentials, encrypted.
func (s *Service) Set(ctx context.Context, tenantID uuid.UUID, appKey, hmacSecret string, updatedBy *uuid.UUID) error {
	if appKey == "" || hmacSecret == "" {
		return apierror.New(422, "validation_error", "app_key et hmac_secret sont obligatoires.")
	}
	encKey, err := s.cryptor.Encrypt(appKey)
	if err != nil {
		return fmt.Errorf("tenantpayment: encrypt app_key: %w", err)
	}
	encSecret, err := s.cryptor.Encrypt(hmacSecret)
	if err != nil {
		return fmt.Errorf("tenantpayment: encrypt hmac_secret: %w", err)
	}
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO tenant_payment_config (tenant_id, app_key_encrypted, hmac_secret_encrypted, updated_by, updated_at)
			VALUES ($1, $2, $3, $4, now())
			ON CONFLICT (tenant_id) DO UPDATE SET
				app_key_encrypted = $2, hmac_secret_encrypted = $3, updated_by = $4, updated_at = now()
		`, tenantID, encKey, encSecret, updatedBy)
		return err
	})
}

// Delete removes a tenant's credentials.
func (s *Service) Delete(ctx context.Context, tenantID uuid.UUID) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `DELETE FROM tenant_payment_config WHERE tenant_id = $1`, tenantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}

// Configured reports whether a tenant has credentials set (never returns
// the plaintext — used by the admin dashboard status view).
func (s *Service) Configured(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	var exists bool
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		return tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM tenant_payment_config WHERE tenant_id = $1)`, tenantID).
			Scan(&exists)
	})
	return exists, err
}

// ClientFor decrypts a tenant's credentials and returns a signed client.
// Returns ErrNotConfigured (wrapped in a 503 apierror) when the tenant has
// no credentials.
func (s *Service) ClientFor(ctx context.Context, tenantID uuid.UUID) (*Client, error) {
	var encKey, encSecret []byte
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		return tx.QueryRow(ctx, `
			SELECT app_key_encrypted, hmac_secret_encrypted FROM tenant_payment_config WHERE tenant_id = $1
		`, tenantID).Scan(&encKey, &encSecret)
	})
	if err != nil {
		return nil, apierror.New(503, "payment_not_configured",
			"Les paiements ne sont pas configurés pour ce commerce. Renseignez ses clés ABMCY Core Payment depuis le dashboard admin.")
	}

	appKey, err := s.cryptor.Decrypt(encKey)
	if err != nil {
		return nil, fmt.Errorf("tenantpayment: decrypt app_key: %w", err)
	}
	hmacSecret, err := s.cryptor.Decrypt(encSecret)
	if err != nil {
		return nil, fmt.Errorf("tenantpayment: decrypt hmac_secret: %w", err)
	}
	return NewClient(s.baseURL, appKey, hmacSecret), nil
}

// HMACSecretFor returns a tenant's raw hmac_secret — needed by the webhook
// handler to verify an incoming ABMCY Core Payment callback signature
// before trusting its body.
func (s *Service) HMACSecretFor(ctx context.Context, tenantID uuid.UUID) (string, error) {
	var encSecret []byte
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		return tx.QueryRow(ctx, `SELECT hmac_secret_encrypted FROM tenant_payment_config WHERE tenant_id = $1`, tenantID).
			Scan(&encSecret)
	})
	if err != nil {
		return "", ErrNotConfigured
	}
	return s.cryptor.Decrypt(encSecret)
}
