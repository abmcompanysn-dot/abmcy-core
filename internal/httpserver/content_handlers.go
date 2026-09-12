package httpserver

import (
	"net/http"

	"github.com/abmcy/core/internal/content"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"github.com/go-chi/chi/v5"
)

// --- Articles (staff) -------------------------------------------------

func (s *Server) handleListArticles(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	articles, err := s.content.List(r.Context(), t.ID, content.ListFilter{
		Category: r.URL.Query().Get("category"),
		Region:   r.URL.Query().Get("region"),
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, articles)
}

func (s *Server) handleCreateArticle(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		Title         string `json:"title"`
		Excerpt       string `json:"excerpt"`
		Body          string `json:"body"`
		Category      string `json:"category"`
		Region        string `json:"region"`
		CoverImageURL string `json:"cover_image_url"`
		IsFeatured    bool   `json:"is_featured"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	a, err := s.content.Create(r.Context(), t.ID, content.CreateArticleInput{
		Title:         body.Title,
		Excerpt:       body.Excerpt,
		Body:          body.Body,
		Category:      body.Category,
		Region:        body.Region,
		CoverImageURL: body.CoverImageURL,
		IsFeatured:    body.IsFeatured,
		AuthorStaffID: t.StaffUserID,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, a)
}

func (s *Server) handleGetArticle(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	articleID, err := parseUUID(chi.URLParam(r, "articleID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	a, err := s.content.Get(r.Context(), t.ID, articleID, false)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, a)
}

func (s *Server) handleUpdateArticle(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	articleID, err := parseUUID(chi.URLParam(r, "articleID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		Title         *string `json:"title"`
		Excerpt       *string `json:"excerpt"`
		Body          *string `json:"body"`
		Category      *string `json:"category"`
		Region        *string `json:"region"`
		CoverImageURL *string `json:"cover_image_url"`
		IsFeatured    *bool   `json:"is_featured"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	a, err := s.content.Update(r.Context(), t.ID, articleID, content.UpdateArticleInput{
		Title:         body.Title,
		Excerpt:       body.Excerpt,
		Body:          body.Body,
		Category:      body.Category,
		Region:        body.Region,
		CoverImageURL: body.CoverImageURL,
		IsFeatured:    body.IsFeatured,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, a)
}

func (s *Server) handleDeleteArticle(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	articleID, err := parseUUID(chi.URLParam(r, "articleID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.content.Delete(r.Context(), t.ID, articleID); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handlePublishArticle(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	articleID, err := parseUUID(chi.URLParam(r, "articleID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	a, err := s.content.Publish(r.Context(), t.ID, articleID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, a)
}

func (s *Server) handleUnpublishArticle(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	articleID, err := parseUUID(chi.URLParam(r, "articleID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	a, err := s.content.Unpublish(r.Context(), t.ID, articleID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, a)
}

// --- Articles (public, anonymous visitors) -----------------------------
//
// First unauthenticated data-reading routes in the codebase — everything
// else requires an X-API-Key or a JWT (staff/admin/customer). The tenant
// is resolved by slug (path param) instead, and reads still go through
// pool.WithTenant so RLS applies exactly as it does everywhere else; only
// published articles are ever reachable here (see content.Service.List/
// Get/IncrementView, all of which filter on status='published' for these
// call sites).

func (s *Server) handlePublicListArticles(w http.ResponseWriter, r *http.Request) {
	t, err := s.lookupTenantBySlug(r.Context(), chi.URLParam(r, "tenantSlug"))
	if err != nil {
		response.Err(w, apierror.ErrNotFound)
		return
	}

	articles, err := s.content.List(r.Context(), t.ID, content.ListFilter{
		Category:      r.URL.Query().Get("category"),
		Region:        r.URL.Query().Get("region"),
		OnlyPublished: true,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, articles)
}

func (s *Server) handlePublicGetArticle(w http.ResponseWriter, r *http.Request) {
	t, err := s.lookupTenantBySlug(r.Context(), chi.URLParam(r, "tenantSlug"))
	if err != nil {
		response.Err(w, apierror.ErrNotFound)
		return
	}
	articleID, err := parseUUID(chi.URLParam(r, "articleID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	a, err := s.content.Get(r.Context(), t.ID, articleID, true)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, a)
}

func (s *Server) handlePublicIncrementView(w http.ResponseWriter, r *http.Request) {
	t, err := s.lookupTenantBySlug(r.Context(), chi.URLParam(r, "tenantSlug"))
	if err != nil {
		response.Err(w, apierror.ErrNotFound)
		return
	}
	articleID, err := parseUUID(chi.URLParam(r, "articleID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.content.IncrementView(r.Context(), t.ID, articleID); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
