package payment

import (
	"context"
	"errors"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Service struct {
	pool   *db.Pool
	config *platformconfig.Service
	orders *order.Service
}

func NewService(pool *db.Pool, config *platformconfig.Service, orders *order.Service) *Service {
	return &Service{pool: pool, config: config, orders: orders}
}

// cinetpayClient builds a CinetPay client from whatever is currently
// configured in platform_config — live, no restart needed after a
// dashboard update.
func (s *Service) cinetpayClient() (*CinetPayClient, error) {
	apiKey, _ := s.config.Get(platformconfig.KeyCinetPayAPIKey)
	siteID, _ := s.config.Get(platformconfig.KeyCinetPaySiteID)
	client, err := NewCinetPayClient(apiKey, siteID)
	if errors.Is(err, ErrNotConfigured) {
		return nil, apierror.New(503, "payment_not_configured",
			"Les paiements ne sont pas encore configurés. Configurez CinetPay depuis le dashboard admin.")
	}
	return client, err
}

// InitiateForOrder starts a CinetPay checkout for an existing order and
// records a "initiated" row in payments so the webhook has something to
// reconcile against.
func (s *Service) InitiateForOrder(ctx context.Context, tenantID, orderID uuid.UUID, amount int, customerName, customerPhone, returnURL, notifyURL string) (*InitPaymentResult, error) {
	cinetpay, err := s.cinetpayClient()
	if err != nil {
		return nil, err
	}

	txRef := "TXN-" + orderID.String()[:8] + "-" + uuid.NewString()[:8]

	result, err := cinetpay.InitPayment(ctx, InitPaymentInput{
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
	cinetpay, err := s.cinetpayClient()
	if err != nil {
		return err
	}

	status, err := cinetpay.VerifyTransaction(ctx, transactionRef)
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
		return s.orders.UpdateStatus(ctx, tenantID, orderID, "paid", "Paiement confirmé par CinetPay")
	}
	return nil
}
