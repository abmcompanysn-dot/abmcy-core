// Package catalog implements the optional storefront layer on top of
// orders: products, fabrics, a server-side cart, a photo gallery, and
// customer reviews. Each of the five is gated independently per-tenant by
// internal/features (RequireProducts, RequireFabrics, RequireCart,
// RequireGallery, RequireReviews) — every method here assumes the caller
// (internal/httpserver) has already checked the matching gate for the
// tenant.
//
// The product model is business-agnostic on purpose: name/description/
// price/category/images are common to any storefront, while sector-
// specific fields (sizes/colors for a tailor, a download link for a
// digital product, a brand/weight for general retail) live in the free-
// form Attributes JSON rather than as dedicated columns. tenants.
// business_type only hints at which Attributes shape the dashboard
// suggests by default — it never restricts what a tenant can store.
package catalog

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Product struct {
	ID            uuid.UUID       `json:"id"`
	Name          string          `json:"name"`
	Description   string          `json:"description,omitempty"`
	Price         int             `json:"price"`
	Category      string          `json:"category,omitempty"`
	SKU           string          `json:"sku,omitempty"`
	StockQuantity *int            `json:"stock_quantity,omitempty"` // nil = illimité/non suivi
	Attributes    json.RawMessage `json:"attributes,omitempty"`
	IsFeatured    bool            `json:"is_featured"`
	IsActive      bool            `json:"is_active"`
	Images        []ProductImage  `json:"images,omitempty"`
}

type ProductImage struct {
	ID  uuid.UUID `json:"id"`
	URL string    `json:"url"`
}

type ProductService struct {
	pool *db.Pool
}

func NewProductService(pool *db.Pool) *ProductService {
	return &ProductService{pool: pool}
}

type CreateProductInput struct {
	Name          string
	Description   string
	Price         int
	Category      string
	SKU           string
	StockQuantity *int
	Attributes    json.RawMessage
	IsFeatured    bool
}

func (s *ProductService) Create(ctx context.Context, tenantID uuid.UUID, in CreateProductInput) (*Product, error) {
	if in.Name == "" || in.Price <= 0 {
		return nil, apierror.ErrValidation
	}

	var p Product
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO products (tenant_id, name, description, price, category, sku, stock_quantity, attributes, is_featured)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id, name, coalesce(description, ''), price, coalesce(category, ''), coalesce(sku, ''), stock_quantity, attributes, is_featured, is_active
		`, tenantID, in.Name, in.Description, in.Price, in.Category, in.SKU, in.StockQuantity, in.Attributes, in.IsFeatured)
		return row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Category, &p.SKU, &p.StockQuantity, &p.Attributes, &p.IsFeatured, &p.IsActive)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: create product: %w", err)
	}
	return &p, nil
}

// ListFilter drives GET /products query params: filter by category, sort
// by price/newest/featured. Attribute-level filtering (e.g. by size or
// gender) is intentionally left to the client — Attributes is free-form
// per tenant, so there's no fixed set of filterable fields to index here.
type ListFilter struct {
	Category string
	Sort     string // "price_asc" | "price_desc" | "newest" | "featured"
}

func (s *ProductService) List(ctx context.Context, tenantID uuid.UUID, f ListFilter) ([]Product, error) {
	orderBy := "created_at DESC"
	switch f.Sort {
	case "price_asc":
		orderBy = "price ASC"
	case "price_desc":
		orderBy = "price DESC"
	case "featured":
		orderBy = "is_featured DESC, created_at DESC"
	}

	var products []Product
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		query := `
			SELECT id, name, coalesce(description, ''), price, coalesce(category, ''), coalesce(sku, ''), stock_quantity, attributes, is_featured, is_active
			FROM products
			WHERE is_active = true
		`
		args := []any{}
		if f.Category != "" {
			query += " AND category = $1"
			args = append(args, f.Category)
		}
		query += " ORDER BY " + orderBy + " LIMIT 200"

		rows, err := tx.Query(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var p Product
			if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Category, &p.SKU, &p.StockQuantity, &p.Attributes, &p.IsFeatured, &p.IsActive); err != nil {
				return err
			}
			products = append(products, p)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: list products: %w", err)
	}
	return products, nil
}

func (s *ProductService) Get(ctx context.Context, tenantID, productID uuid.UUID) (*Product, error) {
	var p Product
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			SELECT id, name, coalesce(description, ''), price, coalesce(category, ''), coalesce(sku, ''), stock_quantity, attributes, is_featured, is_active
			FROM products WHERE id = $1
		`, productID)
		if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Category, &p.SKU, &p.StockQuantity, &p.Attributes, &p.IsFeatured, &p.IsActive); err != nil {
			return apierror.ErrNotFound
		}

		rows, err := tx.Query(ctx, `SELECT id, image_url FROM product_images WHERE product_id = $1 ORDER BY created_at`, productID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var img ProductImage
			if err := rows.Scan(&img.ID, &img.URL); err != nil {
				return err
			}
			p.Images = append(p.Images, img)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpdateProductInput mirrors CreateProductInput but every field is a
// pointer: nil means "leave unchanged", matching how PATCH is expected to
// behave (as opposed to PUT, which would require the caller to resend
// every field). Attributes is the one exception — since it's already a
// free-form JSON blob, a caller wanting to change it sends the full new
// object; there's no field-level merge. StockQuantity has no way to
// distinguish "leave unchanged" from "clear to unlimited" — no caller
// needs that yet, so omitting it in the request just leaves it unchanged.
type UpdateProductInput struct {
	Name          *string
	Description   *string
	Price         *int
	Category      *string
	SKU           *string
	StockQuantity *int
	Attributes    json.RawMessage
	IsFeatured    *bool
	IsActive      *bool
}

func (s *ProductService) Update(ctx context.Context, tenantID, productID uuid.UUID, in UpdateProductInput) (*Product, error) {
	var attrs any
	if len(in.Attributes) > 0 {
		attrs = in.Attributes
	}

	var p Product
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE products SET
				name = coalesce($3, name),
				description = coalesce($4, description),
				price = coalesce($5, price),
				category = coalesce($6, category),
				sku = coalesce($7, sku),
				stock_quantity = coalesce($8, stock_quantity),
				attributes = coalesce($9, attributes),
				is_featured = coalesce($10, is_featured),
				is_active = coalesce($11, is_active),
				updated_at = now()
			WHERE id = $1 AND tenant_id = $2
			RETURNING id, name, coalesce(description, ''), price, coalesce(category, ''), coalesce(sku, ''), stock_quantity, attributes, is_featured, is_active
		`, productID, tenantID,
			in.Name, in.Description, in.Price, in.Category, in.SKU,
			in.StockQuantity, attrs, in.IsFeatured, in.IsActive)
		if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Category, &p.SKU, &p.StockQuantity, &p.Attributes, &p.IsFeatured, &p.IsActive); err != nil {
			return apierror.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &p, nil
}
