package catalog

import (
	"context"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Fabric struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	ExtraPrice  int       `json:"extra_price"`
	ImageURL    string    `json:"image_url,omitempty"`
	IsActive    bool      `json:"is_active"`
}

type FabricService struct {
	pool *db.Pool
}

func NewFabricService(pool *db.Pool) *FabricService {
	return &FabricService{pool: pool}
}

type CreateFabricInput struct {
	Name        string
	Description string
	ExtraPrice  int
	ImageURL    string
}

func (s *FabricService) Create(ctx context.Context, tenantID uuid.UUID, in CreateFabricInput) (*Fabric, error) {
	if in.Name == "" {
		return nil, apierror.ErrValidation
	}

	var f Fabric
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO fabrics (tenant_id, name, description, extra_price, image_url)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, name, coalesce(description, ''), extra_price, coalesce(image_url, ''), is_active
		`, tenantID, in.Name, in.Description, in.ExtraPrice, in.ImageURL)
		return row.Scan(&f.ID, &f.Name, &f.Description, &f.ExtraPrice, &f.ImageURL, &f.IsActive)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: create fabric: %w", err)
	}
	return &f, nil
}

// List returns the tenant's fabric gallery — used both by the tenant
// dashboard (managing the list) and the public storefront (choosing a
// fabric for a custom order).
func (s *FabricService) List(ctx context.Context, tenantID uuid.UUID) ([]Fabric, error) {
	var fabrics []Fabric
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, name, coalesce(description, ''), extra_price, coalesce(image_url, ''), is_active
			FROM fabrics WHERE is_active = true ORDER BY created_at
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var f Fabric
			if err := rows.Scan(&f.ID, &f.Name, &f.Description, &f.ExtraPrice, &f.ImageURL, &f.IsActive); err != nil {
				return err
			}
			fabrics = append(fabrics, f)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: list fabrics: %w", err)
	}
	return fabrics, nil
}

// UpdateFabricInput mirrors UpdateProductInput (internal/catalog/products.go):
// every field a pointer, nil means "leave unchanged" — same PATCH
// convention used across the catalog package.
type UpdateFabricInput struct {
	Name        *string
	Description *string
	ExtraPrice  *int
	ImageURL    *string
	IsActive    *bool
}

func (s *FabricService) Update(ctx context.Context, tenantID, fabricID uuid.UUID, in UpdateFabricInput) (*Fabric, error) {
	var f Fabric
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE fabrics SET
				name = coalesce($3, name),
				description = coalesce($4, description),
				extra_price = coalesce($5, extra_price),
				image_url = coalesce($6, image_url),
				is_active = coalesce($7, is_active),
				updated_at = now()
			WHERE id = $1 AND tenant_id = $2
			RETURNING id, name, coalesce(description, ''), extra_price, coalesce(image_url, ''), is_active
		`, fabricID, tenantID, in.Name, in.Description, in.ExtraPrice, in.ImageURL, in.IsActive)
		if err := row.Scan(&f.ID, &f.Name, &f.Description, &f.ExtraPrice, &f.ImageURL, &f.IsActive); err != nil {
			return apierror.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &f, nil
}
