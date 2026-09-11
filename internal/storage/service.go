package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

type Service struct {
	pool   *db.Pool
	config *platformconfig.Service
}

func NewService(pool *db.Pool, config *platformconfig.Service) *Service {
	return &Service{pool: pool, config: config}
}

type UploadedImage struct {
	ID        uuid.UUID `json:"id"`
	URL       string    `json:"url"`
	SizeBytes int64     `json:"size_bytes"`
}

// r2Client builds an R2 client from whatever is currently configured in
// platform_config (set from the super-admin dashboard, live — no restart
// needed after an update). Building it per-call is cheap: it's just
// struct construction, no network round trip until Upload/Delete runs.
func (s *Service) r2Client() (*R2Client, error) {
	get := func(k platformconfig.Key) string {
		v, _ := s.config.Get(k)
		return v
	}
	client, err := NewR2Client(R2Config{
		AccountID:       get(platformconfig.KeyR2AccountID),
		AccessKeyID:     get(platformconfig.KeyR2AccessKeyID),
		SecretAccessKey: get(platformconfig.KeyR2SecretAccessKey),
		Bucket:          get(platformconfig.KeyR2Bucket),
		PublicURL:       get(platformconfig.KeyR2PublicURL),
	})
	if errors.Is(err, ErrNotConfigured) {
		return nil, apierror.New(503, "storage_not_configured",
			"Le stockage d'images n'est pas encore configuré. Configurez Cloudflare R2 depuis le dashboard admin.")
	}
	return client, err
}

// UploadProductImage enforces the tenant's storage quota (default 5 Go,
// adjustable per plan), uploads the file to R2, then records the
// resulting URL and increments storage_used_bytes — all inside the
// tenant's RLS transaction so quota checks stay race-free per tenant.
func (s *Service) UploadProductImage(ctx context.Context, tenantID uuid.UUID, productID *uuid.UUID, filename, contentType string, data []byte) (*UploadedImage, error) {
	r2, err := s.r2Client()
	if err != nil {
		return nil, err
	}

	fileSize := int64(len(data))

	var quotaOK bool
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
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

	// Upload happens outside the DB transaction — R2 is a slow external
	// call and we don't want to hold a Postgres tx open while waiting on it.
	uploaded, err := r2.Upload(ctx, tenantID, filename, contentType, data)
	if err != nil {
		return nil, fmt.Errorf("storage: r2 upload: %w", err)
	}

	var img UploadedImage
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO product_images (tenant_id, product_id, image_url, size_bytes)
			VALUES ($1, $2, $3, $4)
			RETURNING id, image_url, size_bytes
		`, tenantID, productID, uploaded.URL, uploaded.SizeBytes)
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

// ProductFile is a deliverable attached to a product (e.g. an ebook PDF).
// Unlike UploadedImage, it carries no public URL — see product_files
// migration comment.
type ProductFile struct {
	ID        uuid.UUID `json:"id"`
	Filename  string    `json:"filename"`
	SizeBytes int64     `json:"size_bytes"`
}

// UploadProductFile stores a deliverable file for a product under R2's
// "private/" prefix (never served from the public bucket domain) and
// records it against the tenant's storage quota, same as product images.
func (s *Service) UploadProductFile(ctx context.Context, tenantID, productID uuid.UUID, filename, contentType string, data []byte) (*ProductFile, error) {
	r2, err := s.r2Client()
	if err != nil {
		return nil, err
	}

	fileSize := int64(len(data))

	var quotaOK bool
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
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

	uploaded, err := r2.UploadPrivate(ctx, tenantID, filename, contentType, data)
	if err != nil {
		return nil, fmt.Errorf("storage: r2 upload: %w", err)
	}

	var pf ProductFile
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO product_files (tenant_id, product_id, object_key, filename, size_bytes)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, filename, size_bytes
		`, tenantID, productID, uploaded.Key, filename, uploaded.SizeBytes)
		if err := row.Scan(&pf.ID, &pf.Filename, &pf.SizeBytes); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE tenants SET storage_used_bytes = storage_used_bytes + $1, updated_at = now() WHERE id = $2`,
			uploaded.SizeBytes, tenantID)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("storage: record product file: %w", err)
	}
	return &pf, nil
}

// ListProductFiles returns every deliverable attached to a product.
func (s *Service) ListProductFiles(ctx context.Context, tenantID, productID uuid.UUID) ([]ProductFile, error) {
	var files []ProductFile
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, filename, size_bytes FROM product_files WHERE product_id = $1 ORDER BY created_at ASC
		`, productID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var f ProductFile
			if err := rows.Scan(&f.ID, &f.Filename, &f.SizeBytes); err != nil {
				return err
			}
			files = append(files, f)
		}
		return rows.Err()
	})
	return files, err
}

// DeliveryLink is one downloadable file with a temporary signed URL.
type DeliveryLink struct {
	Filename  string    `json:"filename"`
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}

const deliveryLinkExpiry = 15 * time.Minute

// PresignedFilesForOrder returns time-limited download links for every
// file attached to any product in the given order's line items. The
// caller (handler) is responsible for checking the order is "paid" first
// — this method only signs URLs for whatever product IDs it's given.
func (s *Service) PresignedFilesForOrder(ctx context.Context, tenantID uuid.UUID, productIDs []uuid.UUID) ([]DeliveryLink, error) {
	if len(productIDs) == 0 {
		return nil, nil
	}
	r2, err := s.r2Client()
	if err != nil {
		return nil, err
	}

	type fileRow struct {
		objectKey string
		filename  string
	}
	var rowsOut []fileRow
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT object_key, filename FROM product_files WHERE product_id = ANY($1) ORDER BY created_at ASC
		`, productIDs)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var f fileRow
			if err := rows.Scan(&f.objectKey, &f.filename); err != nil {
				return err
			}
			rowsOut = append(rowsOut, f)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("storage: list files for order: %w", err)
	}

	expiresAt := time.Now().Add(deliveryLinkExpiry)
	links := make([]DeliveryLink, 0, len(rowsOut))
	for _, f := range rowsOut {
		url, err := r2.PresignGetObject(ctx, f.objectKey, deliveryLinkExpiry)
		if err != nil {
			return nil, fmt.Errorf("storage: presign %s: %w", f.objectKey, err)
		}
		links = append(links, DeliveryLink{Filename: f.filename, URL: url, ExpiresAt: expiresAt})
	}
	return links, nil
}
