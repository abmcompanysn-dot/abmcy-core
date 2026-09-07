package payment

import (
	"context"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/order"
	"github.com/google/uuid"
)

type Service struct {
	pool     *db.Pool
	cinetpay *CinetPayClient
	orders   *order.Service
}

func NewService(pool *db.Pool, cinetpay *CinetPayClient, orders *order.Service) *Service {
	return &Service{pool: pool, cinetpay: cinetpay, orders: orders}
}

// InitiateForOrder starts a CinetPay checkout for an existing order and
// records a "initiated" row in payments so the webhook has something to
// reconcile against.
func (s *Service) InitiateForOrder(ctx context.Context, tenantID, orderID uuid.UUID, amount int, customerName, customerPhone, returnURL, notifyURL string) (*InitPaymentResult, error) {
	txRef := "TXN-" + orderID.String()[:8] + "-" + uuid.NewString()[:8]

	result, err := s.cinetpay.InitPayment(ctx, InitPaymentInput{
		TransactionID: txRef,
		Amount:        amount,
		Currency:      "XOF",
		Description:   "Commande " + orderID.String(),
		CustomerName:  customerName,
		CustomerPhone: customerPhone,
		ReturnURL:     returnURL,
		NotifyURL:     notifyURL,
	})
	if err != nil {
		return nil, fmt.Errorf("payment: init: %w", err)
	}

	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO payments (tenant_id, order_id, provider, provider_ref, amount, status)
			VALUES ($1, $2, 'cinetpay', $3, $4, 'initiated')
		`, tenantID, orderID, txRef, amount)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("payment: record: %w", err)
	}

	return result, nil
}

// HandleWebhook is called from the CinetPay notify_url. It re-verifies
// the transaction status directly with CinetPay (never trusts the
// webhook body alone) before marking the payment/order as paid.
func (s *Service) HandleWebhook(ctx context.Context, tenantID uuid.UUID, transactionRef string) error {
	status, err := s.cinetpay.VerifyTransaction(ctx, transactionRef)
	if err != nil {
		return fmt.Errorf("payment: verify: %w", err)
	}

	newStatus := "failed"
	if status == "ACCEPTED" {
		newStatus = "success"
	}

	var orderID uuid.UUID
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE payments SET status = $1 WHERE provider_ref = $2
			RETURNING order_id
		`, newStatus, transactionRef)
		return row.Scan(&orderID)
	})
	if err != nil {
		return fmt.Errorf("payment: update: %w", err)
	}

	if newStatus == "success" {
		return s.orders.UpdateStatus(ctx, tenantID, orderID, "paid")
	}
	return nil
}
