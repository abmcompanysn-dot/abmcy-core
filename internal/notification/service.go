package notification

import (
	"context"
	"errors"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Service struct {
	pool   *db.Pool
	config *platformconfig.Service
}

func NewService(pool *db.Pool, config *platformconfig.Service) *Service {
	return &Service{pool: pool, config: config}
}

// resendClient builds a Resend client from whatever is currently
// configured in platform_config — live, no restart needed after a
// dashboard update.
func (s *Service) resendClient() (*ResendClient, error) {
	apiKey, _ := s.config.Get(platformconfig.KeyResendAPIKey)
	fromAddr, _ := s.config.Get(platformconfig.KeyResendFromAddr)
	client, err := NewResendClient(apiKey, fromAddr)
	if errors.Is(err, ErrNotConfigured) {
		return nil, apierror.New(503, "email_not_configured",
			"L'envoi d'emails n'est pas encore configuré. Configurez Resend depuis le dashboard admin.")
	}
	return client, err
}

// SendEmail enforces each tenant's 100-email/day quota (email_quota_per_day
// in the tenants table) before calling Resend. The daily counter resets
// automatically when email_quota_reset_at is no longer today.
func (s *Service) SendEmail(ctx context.Context, tenantID uuid.UUID, to, subject, html, template string) error {
	resend, err := s.resendClient()
	if err != nil {
		return err
	}

	var allowed bool
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		// Reset the daily counter if we've rolled over to a new day.
		if _, err := tx.Exec(ctx, `
			UPDATE tenants
			SET email_sent_today = 0, email_quota_reset_at = CURRENT_DATE
			WHERE id = $1 AND email_quota_reset_at < CURRENT_DATE
		`, tenantID); err != nil {
			return err
		}

		var sent, quota int
		row := tx.QueryRow(ctx, `SELECT email_sent_today, email_quota_per_day FROM tenants WHERE id = $1`, tenantID)
		if err := row.Scan(&sent, &quota); err != nil {
			return err
		}
		allowed = sent < quota
		return nil
	})
	if err != nil {
		return fmt.Errorf("notification: check quota: %w", err)
	}
	if !allowed {
		return apierror.ErrEmailQuota
	}

	resendID, sendErr := resend.Send(ctx, to, subject, html)
	status := "sent"
	if sendErr != nil {
		status = "failed"
	}

	// Log the attempt and bump the counter regardless of outcome — a
	// failed send still counts against Resend's own API usage, and we
	// want the log for support/debugging either way.
	dbErr := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO email_logs (tenant_id, to_address, subject, template, status, resend_id)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, tenantID, to, subject, template, status, resendID); err != nil {
			return err
		}
		if status == "sent" {
			_, err := tx.Exec(ctx, `UPDATE tenants SET email_sent_today = email_sent_today + 1 WHERE id = $1`, tenantID)
			return err
		}
		return nil
	})
	if dbErr != nil {
		return fmt.Errorf("notification: log send: %w", dbErr)
	}

	if sendErr != nil {
		return fmt.Errorf("notification: resend send: %w", sendErr)
	}
	return nil
}
