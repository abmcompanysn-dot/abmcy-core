package payment

import (
	"context"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/tenantpayment"
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
// status alone.
func (s *Service) HandleWebhook(ctx context.Context, tenantID uuid.UUID, appRef string) error {
	orderID, err := uuid.Parse(appRef)
	if err != nil {
		return fmt.Errorf("payment: webhook: bad app_ref %q: %w", appRef, err)
	}

	client, err := s.tpayment.ClientFor(ctx, tenantID)
	if err != nil {
		return err
	}
	p, err := client.GetPayment(ctx, appRef)
	if err != nil {
		return fmt.Errorf("payment: webhook verify: %w", err)
	}

	return s.applyStatus(ctx, tenantID, orderID, appRef, p.Status)
}

// Reconcile re-checks a still-pending order against ABMCY Core Payment —
// the safety net for a lost webhook. Safe to call repeatedly.
func (s *Service) Reconcile(ctx context.Context, tenantID, orderID uuid.UUID) (string, error) {
	client, err := s.tpayment.ClientFor(ctx, tenantID)
	if err != nil {
		return "", err
	}
	appRef := orderID.String()
	p, err := client.GetPayment(ctx, appRef)
	if err != nil {
		return "", fmt.Errorf("payment: reconcile: %w", err)
	}
	if err := s.applyStatus(ctx, tenantID, orderID, appRef, p.Status); err != nil {
		return "", err
	}
	return p.Status, nil
}

// applyStatus maps an ABMCY Core Payment status onto our payments row and,
// on "completed", moves the order to "paid".
func (s *Service) applyStatus(ctx context.Context, tenantID, orderID uuid.UUID, appRef, coreStatus string) error {
	newStatus := "initiated"
	switch coreStatus {
	case "completed":
		newStatus = "success"
	case "failed", "cancelled":
		newStatus = "failed"
	case "pending", "processing":
		newStatus = "initiated"
	}

	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `UPDATE payments SET status = $1 WHERE provider_ref = $2`, newStatus, appRef)
		return err
	})
	if err != nil {
		return fmt.Errorf("payment: update: %w", err)
	}

	if newStatus == "success" {
		// UpdateStatus is idempotent enough for our needs: re-setting an
		// already-paid order to paid just appends another history row,
		// which a lost-then-replayed webhook can cause. Acceptable.
		return s.orders.UpdateStatus(ctx, tenantID, orderID, "paid", "Paiement confirmé par ABMCY Core Payment")
	}
	return nil
}
