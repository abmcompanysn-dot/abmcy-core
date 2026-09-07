package catalog

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type CartItem struct {
	ID        uuid.UUID  `json:"id"`
	ProductID uuid.UUID  `json:"product_id"`
	FabricID  *uuid.UUID `json:"fabric_id,omitempty"`
	Size      string     `json:"size,omitempty"`
	Color     string     `json:"color,omitempty"`
	Quantity  int        `json:"quantity"`
}

type CartService struct {
	pool *db.Pool
}

func NewCartService(pool *db.Pool) *CartService {
	return &CartService{pool: pool}
}

// NewCartToken generates an opaque token the client stores (e.g. in
// localStorage) to identify its server-side cart across requests, without
// requiring a login or server session.
func NewCartToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("catalog: generate cart token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

type AddItemInput struct {
	CartToken string
	ProductID uuid.UUID
	FabricID  *uuid.UUID
	Size      string
	Color     string
	Quantity  int
}

func (s *CartService) AddItem(ctx context.Context, tenantID uuid.UUID, in AddItemInput) (*CartItem, error) {
	if in.CartToken == "" || in.Quantity <= 0 {
		return nil, apierror.ErrValidation
	}

	var item CartItem
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO cart_items (tenant_id, cart_token, product_id, fabric_id, size, color, quantity)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, product_id, fabric_id, coalesce(size, ''), coalesce(color, ''), quantity
		`, tenantID, in.CartToken, in.ProductID, in.FabricID, in.Size, in.Color, in.Quantity)
		return row.Scan(&item.ID, &item.ProductID, &item.FabricID, &item.Size, &item.Color, &item.Quantity)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: add cart item: %w", err)
	}
	return &item, nil
}

func (s *CartService) Get(ctx context.Context, tenantID uuid.UUID, cartToken string) ([]CartItem, error) {
	var items []CartItem
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, product_id, fabric_id, coalesce(size, ''), coalesce(color, ''), quantity
			FROM cart_items WHERE cart_token = $1 ORDER BY created_at
		`, cartToken)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var item CartItem
			if err := rows.Scan(&item.ID, &item.ProductID, &item.FabricID, &item.Size, &item.Color, &item.Quantity); err != nil {
				return err
			}
			items = append(items, item)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: get cart: %w", err)
	}
	return items, nil
}

func (s *CartService) RemoveItem(ctx context.Context, tenantID uuid.UUID, cartToken string, itemID uuid.UUID) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE id = $1 AND cart_token = $2`, itemID, cartToken)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}
