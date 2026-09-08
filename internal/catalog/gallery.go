package catalog

import (
	"context"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type GalleryPhoto struct {
	ID       uuid.UUID `json:"id"`
	ImageURL string    `json:"image_url"`
	Category string    `json:"category,omitempty"`
	Caption  string    `json:"caption,omitempty"`
}

type GalleryService struct {
	pool *db.Pool
}

func NewGalleryService(pool *db.Pool) *GalleryService {
	return &GalleryService{pool: pool}
}

type AddPhotoInput struct {
	ImageURL string
	Category string // femme | homme | sur_mesure | artisanat
	Caption  string
}

func (s *GalleryService) Add(ctx context.Context, tenantID uuid.UUID, in AddPhotoInput) (*GalleryPhoto, error) {
	if in.ImageURL == "" {
		return nil, apierror.ErrValidation
	}

	var p GalleryPhoto
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO gallery_photos (tenant_id, image_url, category, caption)
			VALUES ($1, $2, $3, $4)
			RETURNING id, image_url, coalesce(category, ''), coalesce(caption, '')
		`, tenantID, in.ImageURL, in.Category, in.Caption)
		return row.Scan(&p.ID, &p.ImageURL, &p.Category, &p.Caption)
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: add gallery photo: %w", err)
	}
	return &p, nil
}

// List returns gallery photos, optionally filtered by category (Femme,
// Homme, Sur mesure, Artisanat).
func (s *GalleryService) List(ctx context.Context, tenantID uuid.UUID, category string) ([]GalleryPhoto, error) {
	var photos []GalleryPhoto
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		query := `
			SELECT id, image_url, coalesce(category, ''), coalesce(caption, '')
			FROM gallery_photos
		`
		args := []any{}
		if category != "" {
			query += ` WHERE category = $1`
			args = append(args, category)
		}
		query += ` ORDER BY created_at DESC`

		rows, err := tx.Query(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var p GalleryPhoto
			if err := rows.Scan(&p.ID, &p.ImageURL, &p.Category, &p.Caption); err != nil {
				return err
			}
			photos = append(photos, p)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("catalog: list gallery: %w", err)
	}
	return photos, nil
}

// UpdatePhotoInput mirrors the same PATCH convention as products/fabrics:
// pointer fields, nil means "leave unchanged".
type UpdatePhotoInput struct {
	Category *string
	Caption  *string
}

func (s *GalleryService) Update(ctx context.Context, tenantID, photoID uuid.UUID, in UpdatePhotoInput) (*GalleryPhoto, error) {
	var p GalleryPhoto
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE gallery_photos SET
				category = coalesce($3, category),
				caption = coalesce($4, caption),
				updated_at = now()
			WHERE id = $1 AND tenant_id = $2
			RETURNING id, image_url, coalesce(category, ''), coalesce(caption, '')
		`, photoID, tenantID, in.Category, in.Caption)
		if err := row.Scan(&p.ID, &p.ImageURL, &p.Category, &p.Caption); err != nil {
			return apierror.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// Delete removes a gallery photo — the client's stated use case is
// clearing out a badly imported photo, not a moderation workflow, so a
// hard delete (rather than an is_active-style soft flag the schema
// doesn't have) is the simplest correct behavior here.
func (s *GalleryService) Delete(ctx context.Context, tenantID, photoID uuid.UUID) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `DELETE FROM gallery_photos WHERE id = $1`, photoID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}
