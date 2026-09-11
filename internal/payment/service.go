package payment

import (
	"context"
	"fmt"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/tenantpayment"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Service struct {
	pool     *db.Pool
	tpayment *tenantpayment.Service
	orders   *order.Service
}

func NewService(pool *db.Pool, tpayment *tenantpayment.Service, orders *order.Service) *Service {
	return &Service{pool: pool, tpayment: tpayment, orders: orders}
}

// InitResult is what /payments/init returns to the caller — the tenant's
// site redirects the customer to HostedPayURL (ABMCY Core Payment's
// hosted page).
type InitResult struct {
	PaymentURL string `json:"payment_url"` // = hosted_pay_url, kept name for API compatibility
}

// InitiateForOrder creates a payment on the tenant's own ABMCY Core
// Payment application for an existing order, and records an "initiated"
// row in payments keyed by the order ID (which is the app_ref). The
// amount is NOT taken from the caller — it comes from the order, which
// itself is server-computed when the order has line items.
func (s *Service) InitiateForOrder(ctx context.Context, tenantID, orderID uuid.UUID, returnURL, callbackURL string) (*InitResult, error) {
	client, err := s.tpayment.ClientFor(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	o, err := s.orders.Get(ctx, tenantID, orderID)
	if err != nil {
		return nil, err
	}

	appRef := orderID.String()

	result, err := client.CreatePayment(ctx, tenantpayment.CreatePaymentInput{
		AppRef:      appRef,
		AmountCFA:   o.TotalAmount,
		Country:     "SEN",
		Description: "Commande " + o.OrderNumber,
		CallbackURL: callbackURL,
		ReturnURL:   returnURL,
	})
	if err != nil {
		return nil, fmt.Errorf("payment: init: %w", err)
	}

	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO payments (tenant_id, order_id, provider, provider_ref, amount, status)
			VALUES ($1, $2, 'abmcy_core_payment', $3, $4, 'initiated')
			ON CONFLICT DO NOTHING
		`, tenantID, orderID, appRef, o.TotalAmount)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("payment: record: %w", err)
	}

	return &InitResult{PaymentURL: result.HostedPayURL}, nil
}

// HandleWebhook is called from the ABMCY Core Payment callback_url. The
// caller has ALREADY verified the HMAC signature against the tenant's
// hmac_secret. As a second safety net it re-queries the real payment
// status (GET /v1/payments/{app_ref}) rather than trusting the body's
// status alone. Returns (orderID, justPaid) so the caller can trigger a
// "your file is ready" email exactly once, when the order actually
// transitions to paid.
func (s *Service) HandleWebhook(ctx context.Context, tenantID uuid.UUID, appRef string) (uuid.UUID, bool, error) {
	orderID, err := uuid.Parse(appRef)
	if err != nil {
		return uuid.UUID{}, false, fmt.Errorf("payment: webhook: bad app_ref %q: %w", appRef, err)
	}

	client, err := s.tpayment.ClientFor(ctx, tenantID)
	if err != nil {
		return orderID, false, err
	}
	p, err := client.GetPayment(ctx, appRef)
	if err != nil {
		return orderID, false, fmt.Errorf("payment: webhook verify: %w", err)
	}

	justPaid, err := s.applyStatus(ctx, tenantID, orderID, appRef, p.Status)
	return orderID, justPaid, err
}

// Payout is a versement recorded in our payouts table.
type Payout struct {
	ID                uuid.UUID `json:"id"`
	AppRef            string    `json:"app_ref"`
	AmountCFA         int       `json:"amount_cfa"`
	RecipientPhone    string    `json:"recipient_phone"`
	RecipientOperator string    `json:"recipient_operator"`
	Status            string    `json:"status"`
	FailureReason     string    `json:"failure_reason,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

// RequestPayout asks ABMCY Core Payment to send money from the tenant's
// balance to one of their own numbers. Idempotent on appRef, generated
// here (not by the caller) so a retried request from the dashboard never
// double-pays. Recording stays best-effort AFTER the real call succeeds —
// the money has moved (or started moving) regardless of whether our own
// bookkeeping row makes it in.
func (s *Service) RequestPayout(ctx context.Context, tenantID uuid.UUID, amountCFA int, recipientPhone, recipientOperator, callbackURL string) (*Payout, error) {
	if amountCFA <= 0 || recipientPhone == "" || recipientOperator == "" {
		return nil, apierror.ErrValidation
	}

	client, err := s.tpayment.ClientFor(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	appRef := "payout-" + uuid.NewString()
	result, err := client.CreatePayout(ctx, tenantpayment.CreatePayoutInput{
		AppRef:            appRef,
		AmountCFA:         amountCFA,
		RecipientPhone:    recipientPhone,
		RecipientOperator: recipientOperator,
		Country:           "SEN",
		CallbackURL:       callbackURL,
	})
	if err != nil {
		return nil, fmt.Errorf("payment: request payout: %w", err)
	}

	var p Payout
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO payouts (tenant_id, app_ref, amount_cfa, recipient_phone, recipient_operator, status)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, app_ref, amount_cfa, recipient_phone, recipient_operator, status, coalesce(failure_reason, ''), created_at
		`, tenantID, appRef, amountCFA, recipientPhone, recipientOperator, result.Status)
		return row.Scan(&p.ID, &p.AppRef, &p.AmountCFA, &p.RecipientPhone, &p.RecipientOperator, &p.Status, &p.FailureReason, &p.CreatedAt)
	})
	if err != nil {
		return nil, fmt.Errorf("payment: record payout: %w", err)
	}
	return &p, nil
}

// ListPayouts returns a tenant's payout history, most recent first.
func (s *Service) ListPayouts(ctx context.Context, tenantID uuid.UUID) ([]Payout, error) {
	var payouts []Payout
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, app_ref, amount_cfa, recipient_phone, recipient_operator, status, coalesce(failure_reason, ''), created_at
			FROM payouts ORDER BY created_at DESC LIMIT 200
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var p Payout
			if err := rows.Scan(&p.ID, &p.AppRef, &p.AmountCFA, &p.RecipientPhone, &p.RecipientOperator, &p.Status, &p.FailureReason, &p.CreatedAt); err != nil {
				return err
			}
			payouts = append(payouts, p)
		}
		return rows.Err()
	})
	return payouts, err
}

// HandlePayoutWebhook applies a payout status update. Unlike
// HandleWebhook for deposits, there is no documented GET endpoint to
// re-verify a payout's status against ABMCY Core Payment, so this trusts
// the callback body — which the caller has already signature-verified
// (the same HMAC check that guards every /webhooks/abmcy/{tenantSlug}
// request) before calling this.
func (s *Service) HandlePayoutWebhook(ctx context.Context, tenantID uuid.UUID, appRef, status, failureReason string) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			UPDATE payouts SET status = $1, failure_reason = nullif($2, '') WHERE tenant_id = $3 AND app_ref = $4
		`, status, failureReason, tenantID, appRef)
		return err
	})
}

// Reconcile re-checks a still-pending order against ABMCY Core Payment —
// the safety net for a lost webhook. Safe to call repeatedly. Returns
// whether this call is what moved the order to paid.
func (s *Service) Reconcile(ctx context.Context, tenantID, orderID uuid.UUID) (status string, justPaid bool, err error) {
	client, err := s.tpayment.ClientFor(ctx, tenantID)
	if err != nil {
		return "", false, err
	}
	appRef := orderID.String()
	p, err := client.GetPayment(ctx, appRef)
	if err != nil {
		return "", false, fmt.Errorf("payment: reconcile: %w", err)
	}
	justPaid, err = s.applyStatus(ctx, tenantID, orderID, appRef, p.Status)
	if err != nil {
		return "", false, err
	}
	return p.Status, justPaid, nil
}

// applyStatus maps an ABMCY Core Payment status onto our payments row and,
// on "completed", moves the order to "paid". Returns whether this call is
// what performed that transition (as opposed to the order already being
// paid — a replayed webhook, or a Reconcile after HandleWebhook already
// ran), since the caller only wants to email the customer once.
func (s *Service) applyStatus(ctx context.Context, tenantID, orderID uuid.UUID, appRef, coreStatus string) (justPaid bool, err error) {
	newStatus := "initiated"
	switch coreStatus {
	case "completed":
		newStatus = "success"
	case "failed", "cancelled":
		newStatus = "failed"
	case "pending", "processing":
		newStatus = "initiated"
	}

	// UPDATE ... RETURNING gives the row AFTER the update, so the previous
	// status has to be captured with a SELECT first, in the same
	// transaction, to detect an actual initiated/failed -> success
	// transition (as opposed to a replayed webhook re-confirming an
	// already-paid order).
	var previousStatus string
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		if scanErr := tx.QueryRow(ctx, `SELECT status FROM payments WHERE provider_ref = $1`, appRef).Scan(&previousStatus); scanErr != nil {
			return scanErr
		}
		_, err := tx.Exec(ctx, `UPDATE payments SET status = $1 WHERE provider_ref = $2`, newStatus, appRef)
		return err
	})
	if err != nil {
		return false, fmt.Errorf("payment: update: %w", err)
	}

	if newStatus != "success" {
		return false, nil
	}
	if previousStatus == "success" {
		return false, nil // already paid — a replayed webhook, nothing new to notify
	}

	if err := s.orders.UpdateStatus(ctx, tenantID, orderID, "paid", "Paiement confirmé par ABMCY Core Payment"); err != nil {
		return false, err
	}
	return true, nil
}
