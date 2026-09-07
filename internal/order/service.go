package order

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Order struct {
	ID            uuid.UUID       `json:"id"`
	OrderNumber   string          `json:"order_number"`
	CustomerName  string          `json:"customer_name"`
	CustomerPhone string          `json:"customer_phone"`
	CustomerEmail string          `json:"customer_email,omitempty"`
	TotalAmount   int             `json:"total_amount"`
	Status        string          `json:"status"`
	Measurements  json.RawMessage `json:"measurements,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

type CreateInput struct {
	CustomerName  string
	CustomerPhone string
	CustomerEmail string
	TotalAmount   int
	Measurements  json.RawMessage
}

type Service struct {
	pool *db.Pool
}

func NewService(pool *db.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) Create(ctx context.Context, tenantID uuid.UUID, in CreateInput) (*Order, error) {
	if in.CustomerName == "" || in.CustomerPhone == "" {
		return nil, apierror.ErrValidation
	}

	var o Order
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		orderNumber := fmt.Sprintf("ORD-%d", time.Now().UnixNano()%1_000_000_000)

		row := tx.QueryRow(ctx, `
			INSERT INTO orders (tenant_id, order_number, customer_name, customer_phone, customer_email, total_amount, measurements)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, order_number, customer_name, customer_phone, coalesce(customer_email, ''), total_amount, status, measurements, created_at
		`, tenantID, orderNumber, in.CustomerName, in.CustomerPhone, in.CustomerEmail, in.TotalAmount, in.Measurements)

		return row.Scan(&o.ID, &o.OrderNumber, &o.CustomerName, &o.CustomerPhone, &o.CustomerEmail,
			&o.TotalAmount, &o.Status, &o.Measurements, &o.CreatedAt)
	})
	if err != nil {
		return nil, fmt.Errorf("order: create: %w", err)
	}
	return &o, nil
}

func (s *Service) List(ctx context.Context, tenantID uuid.UUID) ([]Order, error) {
	var orders []Order
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, order_number, customer_name, customer_phone, coalesce(customer_email, ''), total_amount, status, measurements, created_at
			FROM orders ORDER BY created_at DESC LIMIT 200
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var o Order
			if err := rows.Scan(&o.ID, &o.OrderNumber, &o.CustomerName, &o.CustomerPhone, &o.CustomerEmail,
				&o.TotalAmount, &o.Status, &o.Measurements, &o.CreatedAt); err != nil {
				return err
			}
			orders = append(orders, o)
		}
		return rows.Err()
	})
	return orders, err
}

// UpdateStatus transitions an order (e.g. pending -> paid), called by
// the payment service webhook handler once CinetPay/Stripe confirms.
func (s *Service) UpdateStatus(ctx context.Context, tenantID, orderID uuid.UUID, status string) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`, status, orderID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}
