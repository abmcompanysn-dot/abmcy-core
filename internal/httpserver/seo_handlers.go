package httpserver

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/abmcy/core/internal/catalog"
	"github.com/abmcy/core/internal/seo"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"github.com/go-chi/chi/v5"
)

// Public, unauthenticated (like handlePublicListArticles): sitemap.xml,
// robots.txt and the product feed are meant to be crawled by search
// engines and shopping bots, which never send an X-API-Key. The tenant is
// resolved by slug from the path, same as the rest of this file's
// siblings.

// storefrontPathsFor returns the product/listing path prefix a tenant's
// own storefront uses — /chambres and /prestations for a rental agency
// (see Paradis Services), /produits everywhere else. This only decides
// URL shape for sitemap/feed links; it has no bearing on what the tenant
// can actually store (see catalog/products.go).
func storefrontPathsFor(businessType string) (listingPrefix string, categories []string) {
	if businessType == "agence_immobiliere" {
		return "", []string{"chambre", "prestation"}
	}
	return "/produits", nil
}

func (s *Server) handleSitemap(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "tenantSlug")
	authT, err := s.lookupTenantBySlug(r.Context(), slug)
	if err != nil {
		response.Err(w, apierror.ErrNotFound)
		return
	}
	t, err := s.tenants.Get(r.Context(), authT.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	if t.StorefrontURL == "" {
		response.Err(w, apierror.New(503, "storefront_url_not_configured",
			"Aucune URL de site n'est configurée pour ce compte — contactez ABMCY."))
		return
	}

	pages := []seo.SitemapPage{{Path: "/", ChangeFreq: "daily"}}

	prefix, categories := storefrontPathsFor(t.BusinessType)
	if len(categories) > 0 {
		// agence_immobiliere: /chambres, /prestations, and one page per
		// listing under each — mirrors Paradis Services' actual routes.
		for _, cat := range categories {
			pages = append(pages, seo.SitemapPage{Path: "/" + pluralPath(cat), ChangeFreq: "daily"})
		}
		for _, cat := range categories {
			products, err := s.products.List(r.Context(), t.ID, catalog.ListFilter{Category: cat})
			if err != nil {
				response.Err(w, err)
				return
			}
			for _, p := range products {
				if !p.IsActive {
					continue
				}
				pages = append(pages, seo.SitemapPage{
					Path:       fmt.Sprintf("/%s/%s", pluralPath(cat), p.ID),
					ChangeFreq: "weekly",
				})
			}
		}
	} else {
		pages = append(pages, seo.SitemapPage{Path: prefix, ChangeFreq: "daily"})
		products, err := s.products.List(r.Context(), t.ID, catalog.ListFilter{})
		if err != nil {
			response.Err(w, err)
			return
		}
		for _, p := range products {
			if !p.IsActive {
				continue
			}
			pages = append(pages, seo.SitemapPage{
				Path:       fmt.Sprintf("%s/%s", prefix, p.ID),
				ChangeFreq: "weekly",
			})
		}
	}

	body, err := seo.BuildSitemap(t.StorefrontURL, pages)
	if err != nil {
		response.Err(w, apierror.ErrInternal)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func (s *Server) handleProductFeed(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "tenantSlug")
	authT, err := s.lookupTenantBySlug(r.Context(), slug)
	if err != nil {
		response.Err(w, apierror.ErrNotFound)
		return
	}
	t, err := s.tenants.Get(r.Context(), authT.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	if t.StorefrontURL == "" {
		response.Err(w, apierror.New(503, "storefront_url_not_configured",
			"Aucune URL de site n'est configurée pour ce compte — contactez ABMCY."))
		return
	}

	products, err := s.products.List(r.Context(), t.ID, catalog.ListFilter{})
	if err != nil {
		response.Err(w, err)
		return
	}

	prefix, categories := storefrontPathsFor(t.BusinessType)
	feedProducts := make([]seo.FeedProduct, 0, len(products))
	for _, p := range products {
		path := prefix + "/" + p.ID.String()
		if len(categories) > 0 {
			// agence_immobiliere: link under /chambres or /prestations
			// depending on the product's own category, falling back to
			// the first known category if it doesn't match either
			// (defensive — a product's category is free text elsewhere).
			cat := p.Category
			matched := false
			for _, c := range categories {
				if cat == c {
					matched = true
					break
				}
			}
			if !matched {
				cat = categories[0]
			}
			path = fmt.Sprintf("/%s/%s", pluralPath(cat), p.ID)
		}
		feedProducts = append(feedProducts, seo.FeedProduct{
			Product: p,
			PageURL: strings.TrimRight(t.StorefrontURL, "/") + path,
		})
	}

	body, err := seo.BuildShoppingFeed(t.Name, t.StorefrontURL, feedProducts)
	if err != nil {
		response.Err(w, apierror.ErrInternal)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func (s *Server) handleRobotsTxt(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "tenantSlug")
	authT, err := s.lookupTenantBySlug(r.Context(), slug)
	if err != nil {
		response.Err(w, apierror.ErrNotFound)
		return
	}
	t, err := s.tenants.Get(r.Context(), authT.ID)
	if err != nil {
		response.Err(w, err)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "User-agent: *\nAllow: /\n")
	if t.StorefrontURL != "" {
		fmt.Fprintf(w, "Sitemap: https://api.abmcy.com/tenants/%s/sitemap.xml\n", slug)
	}
}

// pluralPath maps a product category to the storefront path segment that
// lists it — "chambre" -> "chambres", "prestation" -> "prestations".
// Falls back to appending "s" for anything else, which is the right call
// for every category this platform has today (French plurals of the
// nouns used as category values); revisit if a tenant ever needs an
// irregular plural.
func pluralPath(category string) string {
	if strings.HasSuffix(category, "s") {
		return category
	}
	return category + "s"
}
