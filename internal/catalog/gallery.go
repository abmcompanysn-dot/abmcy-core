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
