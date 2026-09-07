package catalog

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Review struct {
	ID          uuid.UUID       `json:"id"`
	OrderID     *uuid.UUID      `json:"order_id,omitempty"`
	CustomerID  *uuid.UUID      `json:"customer_id,omitempty"`
	Rating      int             `json:"rating"`
	Comment     string          `json:"comment,omitempty"`
	PhotoURLs   json.RawMessage `json:"photo_urls,omitempty"`
	IsPublished bool            `json:"is_published"`
}

type ReviewService struct {
	pool *db.Pool
}

func NewReviewService(pool *db.Pool) *ReviewService {
	return &ReviewService{pool: pool}
}

type CreateReviewInput struct {
	OrderID    *uuid.UUID
	CustomerID *uuid.UUID
	Rating     int
	Comment    string
	PhotoURLs  json.RawMessage
}

// Create records a new review, unpublished by default — it needs
// moderation (ReviewService.Publish) from the tenant dashboard before it
// shows up on the public storefront.
func (s *ReviewService) Create(ctx context.Context, tenantID uuid.UUID, in CreateReviewInput) (*Review, error) {
	if in.Rating < 1 || in.Rating > 5 {
		return nil, apierror.New(422, "validation_error", "La note doit être comprise entre 1 et 5.")
	}

	var r Review
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO reviews (tenant_id, order_id, customer_id, rating, comment, photo_urls)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, order_id, customer_id, rating, coalesce(comment, ''), photo_urls, is_published
		`, tenantID, in.OrderID, in.CustomerID, in.Rating, in.Comment, in.PhotoURLs)
		return row.Scan(&r.ID, &r.OrderID, &r.CustomerID, &r.Rating, &r.Comment, &r.PhotoURLs, &r.IsPublished)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: create review: %w", err)
	}
	return &r, nil
}

// ListPublished returns only moderated, published reviews — what the
// public storefront displays.
func (s *ReviewService) ListPublished(ctx context.Context, tenantID uuid.UUID) ([]Review, error) {
	var reviews []Review
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, order_id, customer_id, rating, coalesce(comment, ''), photo_urls, is_published
			FROM reviews WHERE is_published = true ORDER BY created_at DESC LIMIT 100
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var r Review
			if err := rows.Scan(&r.ID, &r.OrderID, &r.CustomerID, &r.Rating, &r.Comment, &r.PhotoURLs, &r.IsPublished); err != nil {
				return err
			}
			reviews = append(reviews, r)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: list published reviews: %w", err)
	}
	return reviews, nil
}

// ListPending returns unmoderated reviews — the tenant dashboard's
// moderation queue.
func (s *ReviewService) ListPending(ctx context.Context, tenantID uuid.UUID) ([]Review, error) {
	var reviews []Review
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, order_id, customer_id, rating, coalesce(comment, ''), photo_urls, is_published
			FROM reviews WHERE is_published = false ORDER BY created_at DESC LIMIT 200
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var r Review
			if err := rows.Scan(&r.ID, &r.OrderID, &r.CustomerID, &r.Rating, &r.Comment, &r.PhotoURLs, &r.IsPublished); err != nil {
				return err
			}
			reviews = append(reviews, r)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: list pending reviews: %w", err)
	}
	return reviews, nil
}

// Publish moderates a review in — called from the tenant dashboard.
func (s *ReviewService) Publish(ctx context.Context, tenantID, reviewID uuid.UUID) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `UPDATE reviews SET is_published = true WHERE id = $1`, reviewID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}
