// Package seo generates the two XML documents a tenant's storefront needs
// for search/shopping discovery: a standard sitemap (Google/Bing indexing)
// and a Google Merchant-style product feed. Both are read-only views over
// data that already exists elsewhere (tenant.StorefrontURL, the product
// catalog) — this package only knows how to serialize them as XML.
package seo

import (
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"github.com/abmcy/core/internal/catalog"
)

// Sitemap XML — https://www.sitemaps.org/protocol.html

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

type sitemapURL struct {
	Loc        string `xml:"loc"`
	LastMod    string `xml:"lastmod,omitempty"`
	ChangeFreq string `xml:"changefreq,omitempty"`
}

// SitemapPage is one page to include — a storefront's own routes (home,
// listing pages) plus one per product, following its own URL scheme
// (e.g. "/chambres/{id}" for a rental listing, "/produits/{id}" for a
// generic shop). The caller decides the path shape; this package only
// joins it to StorefrontURL and serializes it.
type SitemapPage struct {
	Path       string // e.g. "/", "/boutique", "/produits/<uuid>"
	ChangeFreq string // e.g. "daily", "weekly" — optional
}

// BuildSitemap renders a sitemap.xml body for the given storefront base
// URL and pages. baseURL must not have a trailing slash.
func BuildSitemap(baseURL string, pages []SitemapPage) ([]byte, error) {
	baseURL = strings.TrimRight(baseURL, "/")
	now := time.Now().UTC().Format("2006-01-02")

	set := sitemapURLSet{Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9"}
	for _, p := range pages {
		set.URLs = append(set.URLs, sitemapURL{
			Loc:        baseURL + p.Path,
			LastMod:    now,
			ChangeFreq: p.ChangeFreq,
		})
	}

	out, err := xml.MarshalIndent(set, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("seo: marshal sitemap: %w", err)
	}
	return append([]byte(xml.Header), out...), nil
}

// Google Merchant product feed (RSS 2.0 + the google: namespace) —
// https://support.google.com/merchants/answer/7052112

type shoppingFeed struct {
	XMLName xml.Name     `xml:"rss"`
	Version string       `xml:"version,attr"`
	XmlnsG  string       `xml:"xmlns:g,attr"`
	Channel shoppingChan `xml:"channel"`
}

type shoppingChan struct {
	Title string         `xml:"title"`
	Link  string         `xml:"link"`
	Desc  string         `xml:"description"`
	Items []shoppingItem `xml:"item"`
}

type shoppingItem struct {
	ID           string `xml:"g:id"`
	Title        string `xml:"title"`
	Description  string `xml:"description"`
	Link         string `xml:"link"`
	ImageLink    string `xml:"g:image_link,omitempty"`
	Availability string `xml:"g:availability"`
	Price        string `xml:"g:price"`
	Condition    string `xml:"g:condition"`
}

// FeedProduct is the subset of catalog.Product this package needs — kept
// separate from catalog.Product so this package doesn't depend on how the
// caller builds a listing URL (a rental site links to /chambres/{id}, a
// generic shop to /produits/{id}).
type FeedProduct struct {
	Product catalog.Product
	PageURL string // full URL to the product's own page on the storefront
}

// BuildShoppingFeed renders a Google Merchant-compatible XML feed for the
// given tenant name, storefront base URL, and products. Currency is fixed
// to XOF (F CFA) — every tenant on this platform prices in FCFA (see
// catalog.Product.Price, always an int amount in FCFA, never a float or a
// different currency).
func BuildShoppingFeed(tenantName, baseURL string, products []FeedProduct) ([]byte, error) {
	feed := shoppingFeed{
		Version: "2.0",
		XmlnsG:  "http://base.google.com/ns/1.0",
		Channel: shoppingChan{
			Title: tenantName,
			Link:  strings.TrimRight(baseURL, "/"),
			Desc:  fmt.Sprintf("Catalogue produits — %s", tenantName),
		},
	}

	for _, fp := range products {
		p := fp.Product
		if !p.IsActive {
			continue
		}
		availability := "in stock"
		if p.StockQuantity != nil && *p.StockQuantity <= 0 {
			availability = "out of stock"
		}
		var imageLink string
		if len(p.Images) > 0 {
			imageLink = p.Images[0].URL
		}
		feed.Channel.Items = append(feed.Channel.Items, shoppingItem{
			ID:           p.ID.String(),
			Title:        p.Name,
			Description:  descriptionOrName(p),
			Link:         fp.PageURL,
			ImageLink:    imageLink,
			Availability: availability,
			Price:        fmt.Sprintf("%d XOF", p.Price),
			Condition:    "new",
		})
	}

	out, err := xml.MarshalIndent(feed, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("seo: marshal shopping feed: %w", err)
	}
	return append([]byte(xml.Header), out...), nil
}

func descriptionOrName(p catalog.Product) string {
	if p.Description != "" {
		return p.Description
	}
	return p.Name
}
