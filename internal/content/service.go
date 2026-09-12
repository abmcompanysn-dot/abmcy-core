// Package content implements the optional editorial article service — a
// media tenant (tenant.BusinessMedia, e.g. a news site) publishes
// articles instead of, or alongside, a storefront. Gated per-tenant by
// internal/features (RequireContent), same pattern as the five catalog
// services in internal/catalog: every method here assumes the caller
// (internal/httpserver) has already checked that gate.
//
// Category and region are free-form text columns rather than reference
// tables — same choice already made for products.category (see
// internal/catalog/products.go) — until a real need for fine-grained
// management (ordering, translation) justifies the extra structure.
package content

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

const (
	StatusDraft     = "draft"
	StatusPublished = "published"
)

type Article struct {
	ID            uuid.UUID  `json:"id"`
	Title         string     `json:"title"`
	Slug          string     `json:"slug"`
	Excerpt       string     `json:"excerpt,omitempty"`
	Body          string     `json:"body"`
	Category      string     `json:"category,omitempty"`
	Region        string     `json:"region,omitempty"`
	CoverImageURL string     `json:"cover_image_url,omitempty"`
	Status        string     `json:"status"`
	IsFeatured    bool       `json:"is_featured"`
	ViewCount     int        `json:"view_count"`
	AuthorStaffID *uuid.UUID `json:"author_staff_id,omitempty"`
	PublishedAt   *time.Time `json:"published_at,omitempty"`
}

type Service struct {
	pool *db.Pool
}

func NewService(pool *db.Pool) *Service {
	return &Service{pool: pool}
}

var slugInvalidChars = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = slugInvalidChars.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

type CreateArticleInput struct {
	Title         string
	Excerpt       string
	Body          string
	Category      string
	Region        string
	CoverImageURL string
	IsFeatured    bool
	AuthorStaffID *uuid.UUID
}

// Create inserts a new article as a draft. Slug is derived from the title
// and made unique per-tenant by appending a short suffix on collision —
// the caller never provides a slug directly, matching how the MAHU editor
// only ever types a title.
func (s *Service) Create(ctx context.Context, tenantID uuid.UUID, in CreateArticleInput) (*Article, error) {
	if in.Title == "" || in.Body == "" {
		return nil, apierror.ErrValidation
	}

	baseSlug := slugify(in.Title)
	if baseSlug == "" {
		return nil, apierror.ErrValidation
	}

	var a Article
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		slug := baseSlug
		for attempt := 0; ; attempt++ {
			var exists bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM articles WHERE tenant_id = $1 AND slug = $2)`, tenantID, slug).Scan(&exists); err != nil {
				return err
			}
			if !exists {
				break
			}
			attempt++
			slug = fmt.Sprintf("%s-%d", baseSlug, attempt+1)
		}

		row := tx.QueryRow(ctx, `
			INSERT INTO articles (tenant_id, title, slug, excerpt, body, category, region, cover_image_url, is_featured, author_staff_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING id, title, slug, coalesce(excerpt, ''), body, coalesce(category, ''), coalesce(region, ''), coalesce(cover_image_url, ''), status, is_featured, view_count, author_staff_id, published_at
		`, tenantID, in.Title, slug, in.Excerpt, in.Body, in.Category, in.Region, in.CoverImageURL, in.IsFeatured, in.AuthorStaffID)
		return row.Scan(&a.ID, &a.Title, &a.Slug, &a.Excerpt, &a.Body, &a.Category, &a.Region, &a.CoverImageURL, &a.Status, &a.IsFeatured, &a.ViewCount, &a.AuthorStaffID, &a.PublishedAt)
	})
	if err != nil {
		return nil, fmt.Errorf("content: create article: %w", err)
	}
	return &a, nil
}

// ListFilter drives both the staff listing (GET /articles) and the public
// listing (GET /public/{tenantSlug}/articles). OnlyPublished is forced to
// true by the public handler and left to the caller's choice for staff —
// an editor needs to see drafts, a visitor never should.
type ListFilter struct {
	Category      string
	Region        string
	OnlyPublished bool
}

func (s *Service) List(ctx context.Context, tenantID uuid.UUID, f ListFilter) ([]Article, error) {
	var articles []Article
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		query := `
			SELECT id, title, slug, coalesce(excerpt, ''), '', coalesce(category, ''), coalesce(region, ''), coalesce(cover_image_url, ''), status, is_featured, view_count, author_staff_id, published_at
			FROM articles
			WHERE 1=1
		`
		args := []any{}
		if f.OnlyPublished {
			query += " AND status = 'published'"
		}
		if f.Category != "" {
			args = append(args, f.Category)
			query += fmt.Sprintf(" AND category = $%d", len(args))
		}
		if f.Region != "" {
			args = append(args, f.Region)
			query += fmt.Sprintf(" AND region = $%d", len(args))
		}
		query += " ORDER BY coalesce(published_at, created_at) DESC LIMIT 200"

		rows, err := tx.Query(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var a Article
			if err := rows.Scan(&a.ID, &a.Title, &a.Slug, &a.Excerpt, &a.Body, &a.Category, &a.Region, &a.CoverImageURL, &a.Status, &a.IsFeatured, &a.ViewCount, &a.AuthorStaffID, &a.PublishedAt); err != nil {
				return err
			}
			articles = append(articles, a)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("content: list articles: %w", err)
	}
	return articles, nil
}

// Get fetches a single article by ID. onlyPublished mirrors ListFilter's
// flag: the public handler passes true so a draft's ID can't be guessed
// and read by an anonymous visitor.
func (s *Service) Get(ctx context.Context, tenantID, articleID uuid.UUID, onlyPublished bool) (*Article, error) {
	var a Article
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		query := `
			SELECT id, title, slug, coalesce(excerpt, ''), body, coalesce(category, ''), coalesce(region, ''), coalesce(cover_image_url, ''), status, is_featured, view_count, author_staff_id, published_at
			FROM articles WHERE id = $1
		`
		if onlyPublished {
			query += " AND status = 'published'"
		}
		row := tx.QueryRow(ctx, query, articleID)
		if err := row.Scan(&a.ID, &a.Title, &a.Slug, &a.Excerpt, &a.Body, &a.Category, &a.Region, &a.CoverImageURL, &a.Status, &a.IsFeatured, &a.ViewCount, &a.AuthorStaffID, &a.PublishedAt); err != nil {
			return apierror.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// UpdateArticleInput mirrors catalog's UpdateProductInput convention:
// every field is a pointer, nil means "leave unchanged" (PATCH semantics).
type UpdateArticleInput struct {
	Title         *string
	Excerpt       *string
	Body          *string
	Category      *string
	Region        *string
	CoverImageURL *string
	IsFeatured    *bool
}

func (s *Service) Update(ctx context.Context, tenantID, articleID uuid.UUID, in UpdateArticleInput) (*Article, error) {
	var a Article
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE articles SET
				title = coalesce($3, title),
				excerpt = coalesce($4, excerpt),
				body = coalesce($5, body),
				category = coalesce($6, category),
				region = coalesce($7, region),
				cover_image_url = coalesce($8, cover_image_url),
				is_featured = coalesce($9, is_featured),
				updated_at = now()
			WHERE id = $1 AND tenant_id = $2
			RETURNING id, title, slug, coalesce(excerpt, ''), body, coalesce(category, ''), coalesce(region, ''), coalesce(cover_image_url, ''), status, is_featured, view_count, author_staff_id, published_at
		`, articleID, tenantID, in.Title, in.Excerpt, in.Body, in.Category, in.Region, in.CoverImageURL, in.IsFeatured)
		if err := row.Scan(&a.ID, &a.Title, &a.Slug, &a.Excerpt, &a.Body, &a.Category, &a.Region, &a.CoverImageURL, &a.Status, &a.IsFeatured, &a.ViewCount, &a.AuthorStaffID, &a.PublishedAt); err != nil {
			return apierror.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, articleID uuid.UUID) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `DELETE FROM articles WHERE id = $1 AND tenant_id = $2`, articleID, tenantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}

func (s *Service) Publish(ctx context.Context, tenantID, articleID uuid.UUID) (*Article, error) {
	return s.setStatus(ctx, tenantID, articleID, StatusPublished)
}

func (s *Service) Unpublish(ctx context.Context, tenantID, articleID uuid.UUID) (*Article, error) {
	return s.setStatus(ctx, tenantID, articleID, StatusDraft)
}

func (s *Service) setStatus(ctx context.Context, tenantID, articleID uuid.UUID, status string) (*Article, error) {
	var a Article
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE articles SET
				status = $3::varchar,
				published_at = CASE WHEN $3::varchar = 'published' AND published_at IS NULL THEN now() ELSE published_at END,
				updated_at = now()
			WHERE id = $1 AND tenant_id = $2
			RETURNING id, title, slug, coalesce(excerpt, ''), body, coalesce(category, ''), coalesce(region, ''), coalesce(cover_image_url, ''), status, is_featured, view_count, author_staff_id, published_at
		`, articleID, tenantID, status)
		if err := row.Scan(&a.ID, &a.Title, &a.Slug, &a.Excerpt, &a.Body, &a.Category, &a.Region, &a.CoverImageURL, &a.Status, &a.IsFeatured, &a.ViewCount, &a.AuthorStaffID, &a.PublishedAt); err != nil {
			return apierror.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// IncrementView bumps an article's view counter — called from the public,
// unauthenticated /view endpoint. Fire-and-forget from the caller's point
// of view: no anti-abuse guarantee in this first version, same level of
// rigor as the existing traffic logging (internal/traffic), not an
// anti-fraud counter.
func (s *Service) IncrementView(ctx context.Context, tenantID, articleID uuid.UUID) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `UPDATE articles SET view_count = view_count + 1 WHERE id = $1 AND tenant_id = $2 AND status = 'published'`, articleID, tenantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}
