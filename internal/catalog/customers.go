package catalog

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Customer struct {
	ID    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Phone string    `json:"phone"`
	Email string    `json:"email,omitempty"`
}

type CustomerService struct {
	pool *db.Pool
}

func NewCustomerService(pool *db.Pool) *CustomerService {
	return &CustomerService{pool: pool}
}

// FindOrCreate looks up a customer by phone (the natural identifier for
// walk-in/WhatsApp-first businesses like HANI'S — no account/password
// flow) and creates one if it doesn't exist yet. Called whenever an order,
// measurement, or review needs to be attached to a customer.
func (s *CustomerService) FindOrCreate(ctx context.Context, tenantID uuid.UUID, name, phone, email string) (*Customer, error) {
	if name == "" || phone == "" {
		return nil, apierror.ErrValidation
	}

	var c Customer
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO customers (tenant_id, name, phone, email)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (tenant_id, phone) DO UPDATE SET name = $2, email = coalesce(nullif($4, ''), customers.email)
			RETURNING id, name, phone, coalesce(email, '')
		`, tenantID, name, phone, email)
		return row.Scan(&c.ID, &c.Name, &c.Phone, &c.Email)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: find or create customer: %w", err)
	}
	return &c, nil
}

// Measurement is a versioned snapshot of a customer's measurements —
// keeping history rather than overwriting, since HANI'S wants to reuse
// a returning customer's previous measurements.
type Measurement struct {
	ID     uuid.UUID       `json:"id"`
	Gender string          `json:"gender"`
	Values json.RawMessage `json:"values"`
}

type MeasurementService struct {
	pool *db.Pool
}

func NewMeasurementService(pool *db.Pool) *MeasurementService {
	return &MeasurementService{pool: pool}
}

type SaveMeasurementInput struct {
	CustomerID uuid.UUID
	Gender     string // femme | homme — determines which fields the client sent
	Values     json.RawMessage
}

func (s *MeasurementService) Save(ctx context.Context, tenantID uuid.UUID, in SaveMeasurementInput) (*Measurement, error) {
	if in.Gender != "femme" && in.Gender != "homme" {
		return nil, apierror.New(422, "validation_error", "Le genre doit être \"femme\" ou \"homme\".")
	}
	if len(in.Values) == 0 {
		return nil, apierror.ErrValidation
	}

	var m Measurement
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO measurements (tenant_id, customer_id, gender, measurement_values)
			VALUES ($1, $2, $3, $4)
			RETURNING id, gender, measurement_values
		`, tenantID, in.CustomerID, in.Gender, in.Values)
		return row.Scan(&m.ID, &m.Gender, &m.Values)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: save measurement: %w", err)
	}
	return &m, nil
}

// LatestForCustomer returns a customer's most recent measurement set, so
// a returning client doesn't have to re-enter measurements from scratch.
func (s *MeasurementService) LatestForCustomer(ctx context.Context, tenantID, customerID uuid.UUID) (*Measurement, error) {
	var m Measurement
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			SELECT id, gender, measurement_values FROM measurements
			WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1
		`, customerID)
		return row.Scan(&m.ID, &m.Gender, &m.Values)
	})
	if err != nil {
		return nil, apierror.ErrNotFound
	}
	return &m, nil
}
