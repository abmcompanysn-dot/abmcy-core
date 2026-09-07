package storage

import (
	"context"
	"fmt"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Service struct {
	pool  *db.Pool
	imgbb *ImgBBClient
}

func NewService(pool *db.Pool, imgbb *ImgBBClient) *Service {
	return &Service{pool: pool, imgbb: imgbb}
}

type UploadedImage struct {
	ID        uuid.UUID `json:"id"`
	URL       string    `json:"url"`
	SizeBytes int64     `json:"size_bytes"`
}

// UploadProductImage enforces the tenant's storage quota (default 5 Go,
// adjustable per plan), uploads the file to imgbb, then records the
// resulting URL and increments storage_used_bytes — all inside the
// tenant's RLS transaction so quota checks stay race-free per tenant.
func (s *Service) UploadProductImage(ctx context.Context, tenantID uuid.UUID, productID *uuid.UUID, filename string, data []byte) (*UploadedImage, error) {
	fileSize := int64(len(data))

	var quotaOK bool
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		var used, limit int64
		row := tx.QueryRow(ctx, `SELECT storage_used_bytes, storage_limit_bytes FROM tenants WHERE id = $1`, tenantID)
		if err := row.Scan(&used, &limit); err != nil {
			return err
		}
		quotaOK = used+fileSize <= limit
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("storage: check quota: %w", err)
	}
	if !quotaOK {
		return nil, apierror.ErrStorageQuota
	}

	// Upload happens outside the DB transaction — imgbb is a slow external
	// call and we don't want to hold a Postgres tx open while waiting on it.
	uploaded, err := s.imgbb.Upload(ctx, filename, data)
	if err != nil {
		return nil, fmt.Errorf("storage: imgbb upload: %w", err)
	}

	var img UploadedImage
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO product_images (tenant_id, product_id, imgbb_url, imgbb_delete_url, size_bytes)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, imgbb_url, size_bytes
		`, tenantID, productID, uploaded.URL, uploaded.DeleteURL, uploaded.SizeBytes)
		if err := row.Scan(&img.ID, &img.URL, &img.SizeBytes); err != nil {
			return err
		}

		_, err := tx.Exec(ctx, `UPDATE tenants SET storage_used_bytes = storage_used_bytes + $1, updated_at = now() WHERE id = $2`,
			uploaded.SizeBytes, tenantID)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("storage: record upload: %w", err)
	}

	return &img, nil
}
