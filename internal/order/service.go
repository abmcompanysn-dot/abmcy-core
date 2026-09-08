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
	ID              uuid.UUID       `json:"id"`
	OrderNumber     string          `json:"order_number"`
	CustomerID      *uuid.UUID      `json:"customer_id,omitempty"`
	CustomerName    string          `json:"customer_name"`
	CustomerPhone   string          `json:"customer_phone"`
	CustomerEmail   string          `json:"customer_email,omitempty"`
	ShippingAddress string          `json:"shipping_address,omitempty"`
	TotalAmount     int             `json:"total_amount"`
	Status          string          `json:"status"`
	Measurements    json.RawMessage `json:"measurements,omitempty"`
	MeasurementsID  *uuid.UUID      `json:"measurements_id,omitempty"`
	FabricID        *uuid.UUID      `json:"fabric_id,omitempty"`
	FabricSource    string          `json:"fabric_source,omitempty"` // maison | envoi_photo | conseil_atelier
	Notes           string          `json:"notes,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

type CreateInput struct {
	CustomerID      *uuid.UUID
	CustomerName    string
	CustomerPhone   string
	CustomerEmail   string
	ShippingAddress string
	TotalAmount     int
	Measurements    json.RawMessage
	MeasurementsID  *uuid.UUID
	FabricID        *uuid.UUID
	FabricSource    string
	Notes           string
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
			INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, customer_phone, customer_email,
				shipping_address, total_amount, measurements, measurements_id, fabric_id, fabric_source, notes)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			RETURNING id, order_number, customer_id, customer_name, customer_phone, coalesce(customer_email, ''),
				coalesce(shipping_address, ''), total_amount, status, measurements, measurements_id, fabric_id,
				coalesce(fabric_source, ''), coalesce(notes, ''), created_at
		`, tenantID, orderNumber, in.CustomerID, in.CustomerName, in.CustomerPhone, in.CustomerEmail,
			in.ShippingAddress, in.TotalAmount, in.Measurements, in.MeasurementsID, in.FabricID, in.FabricSource, in.Notes)

		if err := row.Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.CustomerPhone, &o.CustomerEmail,
			&o.ShippingAddress, &o.TotalAmount, &o.Status, &o.Measurements, &o.MeasurementsID, &o.FabricID,
			&o.FabricSource, &o.Notes, &o.CreatedAt); err != nil {
			return err
		}

		_, err := tx.Exec(ctx, `INSERT INTO order_status_history (tenant_id, order_id, status) VALUES ($1, $2, $3)`,
			tenantID, o.ID, o.Status)
		return err
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
			SELECT id, order_number, customer_id, customer_name, customer_phone, coalesce(customer_email, ''),
				coalesce(shipping_address, ''), total_amount, status, measurements, measurements_id, fabric_id,
				coalesce(fabric_source, ''), coalesce(notes, ''), created_at
			FROM orders ORDER BY created_at DESC LIMIT 200
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var o Order
			if err := rows.Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.CustomerPhone, &o.CustomerEmail,
				&o.ShippingAddress, &o.TotalAmount, &o.Status, &o.Measurements, &o.MeasurementsID, &o.FabricID,
				&o.FabricSource, &o.Notes, &o.CreatedAt); err != nil {
				return err
			}
			orders = append(orders, o)
		}
		return rows.Err()
	})
	return orders, err
}

func (s *Service) Get(ctx context.Context, tenantID, orderID uuid.UUID) (*Order, error) {
	var o Order
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			SELECT id, order_number, customer_id, customer_name, customer_phone, coalesce(customer_email, ''),
				coalesce(shipping_address, ''), total_amount, status, measurements, measurements_id, fabric_id,
				coalesce(fabric_source, ''), coalesce(notes, ''), created_at
			FROM orders WHERE id = $1
		`, orderID)
		return row.Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.CustomerPhone, &o.CustomerEmail,
			&o.ShippingAddress, &o.TotalAmount, &o.Status, &o.Measurements, &o.MeasurementsID, &o.FabricID,
			&o.FabricSource, &o.Notes, &o.CreatedAt)
	})
	if err != nil {
		return nil, apierror.ErrNotFound
	}
	return &o, nil
}

// UpdateInput carries the fields a tenant can still change before an
// order is validated (paid) — address, measurements, a comment.
type UpdateInput struct {
	ShippingAddress *string
	Measurements    json.RawMessage
	Notes           *string
}

func (s *Service) Update(ctx context.Context, tenantID, orderID uuid.UUID, in UpdateInput) (*Order, error) {
	var o Order
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE orders SET
				shipping_address = coalesce($1, shipping_address),
				measurements = coalesce($2, measurements),
				notes = coalesce($3, notes),
				updated_at = now()
			WHERE id = $4 AND status IN ('pending', 'confirmed')
			RETURNING id, order_number, customer_id, customer_name, customer_phone, coalesce(customer_email, ''),
				coalesce(shipping_address, ''), total_amount, status, measurements, measurements_id, fabric_id,
				coalesce(fabric_source, ''), coalesce(notes, ''), created_at
		`, in.ShippingAddress, in.Measurements, in.Notes, orderID)
		return row.Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.CustomerPhone, &o.CustomerEmail,
			&o.ShippingAddress, &o.TotalAmount, &o.Status, &o.Measurements, &o.MeasurementsID, &o.FabricID,
			&o.FabricSource, &o.Notes, &o.CreatedAt)
	})
	if err != nil {
		return nil, apierror.New(409, "order_not_editable", "Cette commande ne peut plus être modifiée.")
	}
	return &o, nil
}

// UpdateStatus transitions an order (e.g. pending -> paid), called by the
// payment webhook handler or the tenant dashboard. Every transition is
// recorded in order_status_history so the client can see the update trail.
func (s *Service) UpdateStatus(ctx context.Context, tenantID, orderID uuid.UUID, status string, comment string) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`, status, orderID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}

		_, err = tx.Exec(ctx, `INSERT INTO order_status_history (tenant_id, order_id, status, comment) VALUES ($1, $2, $3, nullif($4, ''))`,
			tenantID, orderID, status, comment)
		return err
	})
}

// ValidStatuses enumerates every status an order can be in (see
// migrations/0001_init.sql, orders.status column comment) — used to
// validate PATCH /orders/{id}/status input before writing it.
var ValidStatuses = map[string]bool{
	"pending":     true,
	"confirmed":   true,
	"paid":        true,
	"in_progress": true,
	"shipped":     true,
	"delivered":   true,
	"cancelled":   true,
}

// SetStatus changes an order's status directly — unlike Update, this is
// allowed regardless of the order's current status: moving an order
// through the pipeline (pending -> confirmed -> paid -> ...) is exactly
// what should still be possible once the order is "locked" for ordinary
// field edits (address/measurements/notes). Every change is recorded in
// order_status_history, same as UpdateStatus (used by the CinetPay
// webhook) — this is the tenant-dashboard-facing equivalent.
func (s *Service) SetStatus(ctx context.Context, tenantID, orderID uuid.UUID, status, comment string) (*Order, error) {
	if !ValidStatuses[status] {
		return nil, apierror.New(422, "validation_error", "Statut de commande invalide.")
	}

	var o Order
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE orders SET status = $1, updated_at = now() WHERE id = $2
			RETURNING id, order_number, customer_id, customer_name, customer_phone, coalesce(customer_email, ''),
				coalesce(shipping_address, ''), total_amount, status, measurements, measurements_id, fabric_id,
				coalesce(fabric_source, ''), coalesce(notes, ''), created_at
		`, status, orderID)
		if err := row.Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.CustomerPhone, &o.CustomerEmail,
			&o.ShippingAddress, &o.TotalAmount, &o.Status, &o.Measurements, &o.MeasurementsID, &o.FabricID,
			&o.FabricSource, &o.Notes, &o.CreatedAt); err != nil {
			return err
		}

		_, err := tx.Exec(ctx, `INSERT INTO order_status_history (tenant_id, order_id, status, comment) VALUES ($1, $2, $3, nullif($4, ''))`,
			tenantID, orderID, status, comment)
		return err
	})
	if err != nil {
		return nil, apierror.ErrNotFound
	}
	return &o, nil
}

type StatusEvent struct {
	Status    string    `json:"status"`
	Comment   string    `json:"comment,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// History returns an order's full status trail — "l'historique des mises
// à jour" the client sees on their order detail view.
func (s *Service) History(ctx context.Context, tenantID, orderID uuid.UUID) ([]StatusEvent, error) {
	var events []StatusEvent
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT status, coalesce(comment, ''), created_at FROM order_status_history
			WHERE order_id = $1 ORDER BY created_at ASC
		`, orderID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e StatusEvent
			if err := rows.Scan(&e.Status, &e.Comment, &e.CreatedAt); err != nil {
				return err
			}
			events = append(events, e)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("order: history: %w", err)
	}
	return events, nil
}
