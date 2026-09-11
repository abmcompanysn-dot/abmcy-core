// Package platformconfig lets ABMCY-wide service credentials (R2, Resend)
// be set and changed from the super-admin dashboard instead of being
// frozen into .env files on the VPS at deploy time. Payment credentials
// are NOT here — they're per-tenant, see internal/tenantpayment. Values are read here first; when a key has never
// been configured, callers fall back to the matching environment
// variable, so a fresh deployment still boots (see config.Load) and every
// feature that depends on an unset key degrades to a clear 503 instead of
// crashing the whole process.
package platformconfig

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/google/uuid"
)

// Key is every credential ABMCY operators can manage from the dashboard.
// Keep this list in sync with what internal/httpserver exposes on
// GET/PUT /admin/config so the UI never has to guess valid key names.
type Key string

const (
	KeyR2AccountID       Key = "R2_ACCOUNT_ID"
	KeyR2AccessKeyID     Key = "R2_ACCESS_KEY_ID"
	KeyR2SecretAccessKey Key = "R2_SECRET_ACCESS_KEY"
	KeyR2Bucket          Key = "R2_BUCKET"
	KeyR2PublicURL       Key = "R2_PUBLIC_URL"
	KeyResendAPIKey      Key = "RESEND_API_KEY"
	KeyResendFromAddr    Key = "RESEND_FROM_ADDR"
	// Payments are no longer configured here: each tenant has its own
	// ABMCY Core Payment credentials, stored per-tenant and encrypted in
	// tenant_payment_config — see internal/tenantpayment.
	//
	// KeyCorsOrigins holds the comma-separated list of origins allowed to
	// call the API from a browser (see httpserver.corsMiddleware) — each
	// tenant's own storefront (e.g. https://hani.abmcy.com) needs to be
	// added here before its site can call api.abmcy.com from JS. Falls
	// back to the CORS_ORIGINS env var when never configured, so a fresh
	// deploy still serves the two ABMCY-owned dashboards out of the box.
	KeyCorsOrigins Key = "CORS_ORIGINS"
)

// AllKeys drives the dashboard's config form and input validation — any
// key not in this list is rejected by the admin PUT handler.
var AllKeys = []Key{
	KeyR2AccountID, KeyR2AccessKeyID, KeyR2SecretAccessKey, KeyR2Bucket, KeyR2PublicURL,
	KeyResendAPIKey, KeyResendFromAddr,
	KeyCorsOrigins,
}

// secretKeys never has its value echoed back to the dashboard once set —
// only "is it configured" (bool), never the plaintext. Non-secret keys
// (bucket name, public URL, from-address) are fine to show back for
// editing.
var secretKeys = map[Key]bool{
	KeyR2AccessKeyID:     true,
	KeyR2SecretAccessKey: true,
	KeyResendAPIKey:      true,
}

func IsSecret(k Key) bool { return secretKeys[k] }

type Service struct {
	pool    *db.Pool
	cryptor *cryptor

	mu    sync.RWMutex
	cache map[Key]string
}

// NewService builds the config service. base64EncryptionKey must decode to
// exactly 32 bytes (AES-256) — generate one with
// `openssl rand -base64 32` and set it as CONFIG_ENCRYPTION_KEY.
func NewService(pool *db.Pool, base64EncryptionKey string) (*Service, error) {
	c, err := newCryptor(base64EncryptionKey)
	if err != nil {
		return nil, err
	}
	return &Service{pool: pool, cryptor: c, cache: make(map[Key]string)}, nil
}

// Load reads every configured key from Postgres into memory once at
// startup (and after every dashboard update), so the hot path for reading
// a key never hits the database.
func (s *Service) Load(ctx context.Context) error {
	fresh := make(map[Key]string)
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `SELECT key, value_encrypted FROM platform_config`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var key string
			var encrypted []byte
			if err := rows.Scan(&key, &encrypted); err != nil {
				return err
			}
			plaintext, err := s.cryptor.decrypt(encrypted)
			if err != nil {
				return fmt.Errorf("decrypt key %s: %w", key, err)
			}
			fresh[Key(key)] = plaintext
		}
		return rows.Err()
	})
	if err != nil {
		return fmt.Errorf("platformconfig: load: %w", err)
	}

	s.mu.Lock()
	s.cache = fresh
	s.mu.Unlock()
	return nil
}

// StartAutoRefresh reloads the cache from Postgres every interval, until
// ctx is cancelled. Necessary because Set only updates the cache of the
// pod that handled the write — with more than one API replica, every
// OTHER replica's Get would otherwise keep answering "not configured"
// for a freshly-set key forever (Load only ever runs once, at startup).
// A refresh failure is logged and skipped rather than fatal — a
// transient DB hiccup shouldn't take down request handling, which keeps
// serving from the last good cache in the meantime.
func (s *Service) StartAutoRefresh(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.Load(ctx); err != nil {
					slog.Error("platformconfig: auto-refresh failed", "error", err)
				}
			}
		}
	}()
}

// Get returns a configured value and whether it was actually set. Callers
// combine this with an environment-variable fallback (see config.Config)
// so a never-configured key doesn't behave differently from an empty one.
func (s *Service) Get(key Key) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.cache[key]
	return v, ok && v != ""
}

// Set writes one key (encrypted) and refreshes the in-memory cache so the
// change is live immediately, without a redeploy or restart.
// updatedBy is nil when the request was authenticated via the static
// X-Admin-Key rather than an individual admin JWT — there's no per-user
// identity to attach in that case, and platform_config.updated_by is
// nullable precisely for this.
func (s *Service) Set(ctx context.Context, key Key, value string, updatedBy *uuid.UUID) error {
	encrypted, err := s.cryptor.encrypt(value)
	if err != nil {
		return fmt.Errorf("platformconfig: encrypt: %w", err)
	}

	err = s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO platform_config (key, value_encrypted, updated_by, updated_at)
			VALUES ($1, $2, $3, now())
			ON CONFLICT (key) DO UPDATE SET value_encrypted = $2, updated_by = $3, updated_at = now()
		`, string(key), encrypted, updatedBy)
		return err
	})
	if err != nil {
		return fmt.Errorf("platformconfig: set: %w", err)
	}

	s.mu.Lock()
	s.cache[key] = value
	s.mu.Unlock()
	return nil
}

// Status reports, for every managed key, whether it's configured — used
// by the dashboard's Configuration page. Secret values are never
// returned in plaintext; non-secret ones are, so they can be edited.
type Status struct {
	Key        Key    `json:"key"`
	Configured bool   `json:"configured"`
	Value      string `json:"value,omitempty"` // only populated for non-secret keys
}

// StatusAll reads straight from Postgres rather than the in-memory
// cache: with more than one API replica, each pod's cache only reflects
// the writes it personally handled (Set updates the writer's own cache,
// never the other replicas'), so a GET landing on a different pod than
// the last PUT could show a stale "not configured" for a key that was
// just set. This endpoint is called rarely (from the admin dashboard),
// so the extra round trip is cheap — Get, on the hot path for every
// upload/email/payment, keeps using the cache for speed.
func (s *Service) StatusAll(ctx context.Context) ([]Status, error) {
	current := make(map[Key]string)
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `SELECT key, value_encrypted FROM platform_config`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var key string
			var encrypted []byte
			if err := rows.Scan(&key, &encrypted); err != nil {
				return err
			}
			plaintext, err := s.cryptor.decrypt(encrypted)
			if err != nil {
				return fmt.Errorf("decrypt key %s: %w", key, err)
			}
			current[Key(key)] = plaintext
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("platformconfig: status all: %w", err)
	}

	out := make([]Status, 0, len(AllKeys))
	for _, k := range AllKeys {
		v, ok := current[k]
		st := Status{Key: k, Configured: ok && v != ""}
		if st.Configured && !IsSecret(k) {
			st.Value = v
		}
		out = append(out, st)
	}
	return out, nil
}
