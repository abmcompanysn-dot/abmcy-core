// Package catalog implements the optional storefront layer on top of
// orders: products, fabrics, a server-side cart, a photo gallery, and
// customer reviews. Gated per-tenant by internal/features — every method
// here assumes the caller (internal/httpserver) has already checked
// features.RequireCatalog for the tenant.
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
	ID          uuid.UUID       `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Price       int             `json:"price"`
	Gender      string          `json:"gender,omitempty"`
	Category    string          `json:"category,omitempty"`
	Sizes       json.RawMessage `json:"sizes,omitempty"`
	Colors      json.RawMessage `json:"colors,omitempty"`
	IsFeatured  bool            `json:"is_featured"`
	IsActive    bool            `json:"is_active"`
	Images      []ProductImage  `json:"images,omitempty"`
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
	Name        string
	Description string
	Price       int
	Gender      string
	Category    string
	Sizes       json.RawMessage
	Colors      json.RawMessage
	IsFeatured  bool
}

func (s *ProductService) Create(ctx context.Context, tenantID uuid.UUID, in CreateProductInput) (*Product, error) {
	if in.Name == "" || in.Price <= 0 {
		return nil, apierror.ErrValidation
	}

	var p Product
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO products (tenant_id, name, description, price, gender, category, sizes, colors, is_featured)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id, name, coalesce(description, ''), price, coalesce(gender, ''), coalesce(category, ''), sizes, colors, is_featured, is_active
		`, tenantID, in.Name, in.Description, in.Price, in.Gender, in.Category, in.Sizes, in.Colors, in.IsFeatured)
		return row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Gender, &p.Category, &p.Sizes, &p.Colors, &p.IsFeatured, &p.IsActive)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: create product: %w", err)
	}
	return &p, nil
}

// ListFilter drives GET /catalog/products query params: filter by
// gender/category, sort by price/newest/featured.
type ListFilter struct {
	Gender   string
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
			SELECT id, name, coalesce(description, ''), price, coalesce(gender, ''), coalesce(category, ''), sizes, colors, is_featured, is_active
			FROM products
			WHERE is_active = true
		`
		args := []any{}
		argN := 1
		if f.Gender != "" {
			argN++
			query += fmt.Sprintf(" AND gender = $%d", argN-1)
			args = append(args, f.Gender)
		}
		if f.Category != "" {
			argN++
			query += fmt.Sprintf(" AND category = $%d", argN-1)
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
			if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Gender, &p.Category, &p.Sizes, &p.Colors, &p.IsFeatured, &p.IsActive); err != nil {
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
			SELECT id, name, coalesce(description, ''), price, coalesce(gender, ''), coalesce(category, ''), sizes, colors, is_featured, is_active
			FROM products WHERE id = $1
		`, productID)
		if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Gender, &p.Category, &p.Sizes, &p.Colors, &p.IsFeatured, &p.IsActive); err != nil {
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
