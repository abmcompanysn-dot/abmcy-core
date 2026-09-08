package httpserver

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/abmcy/core/internal/catalog"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// --- Products -------------------------------------------------------

func (s *Server) handleListProducts(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	f := catalog.ListFilter{
		Category: r.URL.Query().Get("category"),
		Sort:     r.URL.Query().Get("sort"),
	}

	products, err := s.products.List(r.Context(), t.ID, f)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, products)
}

func (s *Server) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		Name          string          `json:"name"`
		Description   string          `json:"description"`
		Price         int             `json:"price"`
		Category      string          `json:"category"`
		SKU           string          `json:"sku"`
		StockQuantity *int            `json:"stock_quantity"`
		Attributes    json.RawMessage `json:"attributes"`
		IsFeatured    bool            `json:"is_featured"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	p, err := s.products.Create(r.Context(), t.ID, catalog.CreateProductInput{
		Name:          body.Name,
		Description:   body.Description,
		Price:         body.Price,
		Category:      body.Category,
		SKU:           body.SKU,
		StockQuantity: body.StockQuantity,
		Attributes:    body.Attributes,
		IsFeatured:    body.IsFeatured,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, p)
}

func (s *Server) handleGetProduct(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	productID, err := parseUUID(chi.URLParam(r, "productID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	p, err := s.products.Get(r.Context(), t.ID, productID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (s *Server) handleUpdateProduct(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	productID, err := parseUUID(chi.URLParam(r, "productID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		Name          *string         `json:"name"`
		Description   *string         `json:"description"`
		Price         *int            `json:"price"`
		Category      *string         `json:"category"`
		SKU           *string         `json:"sku"`
		StockQuantity *int            `json:"stock_quantity"`
		Attributes    json.RawMessage `json:"attributes"`
		IsFeatured    *bool           `json:"is_featured"`
		IsActive      *bool           `json:"is_active"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	p, err := s.products.Update(r.Context(), t.ID, productID, catalog.UpdateProductInput{
		Name:          body.Name,
		Description:   body.Description,
		Price:         body.Price,
		Category:      body.Category,
		SKU:           body.SKU,
		StockQuantity: body.StockQuantity,
		Attributes:    body.Attributes,
		IsFeatured:    body.IsFeatured,
		IsActive:      body.IsActive,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

// --- Fabrics ----------------------------------------------------------

func (s *Server) handleListFabrics(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	fabrics, err := s.fabrics.List(r.Context(), t.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, fabrics)
}

func (s *Server) handleCreateFabric(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ExtraPrice  int    `json:"extra_price"`
		ImageURL    string `json:"image_url"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	f, err := s.fabrics.Create(r.Context(), t.ID, catalog.CreateFabricInput{
		Name:        body.Name,
		Description: body.Description,
		ExtraPrice:  body.ExtraPrice,
		ImageURL:    body.ImageURL,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, f)
}

func (s *Server) handleUpdateFabric(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	fabricID, err := parseUUID(chi.URLParam(r, "fabricID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		ExtraPrice  *int    `json:"extra_price"`
		ImageURL    *string `json:"image_url"`
		IsActive    *bool   `json:"is_active"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	f, err := s.fabrics.Update(r.Context(), t.ID, fabricID, catalog.UpdateFabricInput{
		Name:        body.Name,
		Description: body.Description,
		ExtraPrice:  body.ExtraPrice,
		ImageURL:    body.ImageURL,
		IsActive:    body.IsActive,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, f)
}

// handleUploadFabricPhoto lets a client upload a photo of their own fabric
// (the "envoi_photo" flow) — reuses the same R2 upload path as product
// images, just without attaching a product_id.
func (s *Server) handleUploadFabricPhoto(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		response.Err(w, apierror.New(413, "file_too_large", "Fichier trop volumineux."))
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		response.Err(w, apierror.ErrInternal)
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	img, err := s.storage.UploadProductImage(r.Context(), t.ID, nil, header.Filename, contentType, data)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]string{"url": img.URL})
}

// --- Gallery ------------------------------------------------------------

func (s *Server) handleListGallery(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	photos, err := s.gallery.List(r.Context(), t.ID, r.URL.Query().Get("category"))
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, photos)
}

func (s *Server) handleAddGalleryPhoto(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		ImageURL string `json:"image_url"`
		Category string `json:"category"`
		Caption  string `json:"caption"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	p, err := s.gallery.Add(r.Context(), t.ID, catalog.AddPhotoInput{
		ImageURL: body.ImageURL,
		Category: body.Category,
		Caption:  body.Caption,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, p)
}

func (s *Server) handleUpdateGalleryPhoto(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	photoID, err := parseUUID(chi.URLParam(r, "photoID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		Category *string `json:"category"`
		Caption  *string `json:"caption"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	p, err := s.gallery.Update(r.Context(), t.ID, photoID, catalog.UpdatePhotoInput{
		Category: body.Category,
		Caption:  body.Caption,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (s *Server) handleDeleteGalleryPhoto(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	photoID, err := parseUUID(chi.URLParam(r, "photoID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.gallery.Delete(r.Context(), t.ID, photoID); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Cart -----------------------------------------------------------------

func (s *Server) handleGetCart(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	cartToken := r.URL.Query().Get("cart_token")
	if cartToken == "" {
		response.Err(w, apierror.ErrValidation)
		return
	}

	items, err := s.cart.Get(r.Context(), t.ID, cartToken)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, items)
}

func (s *Server) handleAddCartItem(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		CartToken string  `json:"cart_token"`
		ProductID string  `json:"product_id"`
		FabricID  *string `json:"fabric_id"`
		Size      string  `json:"size"`
		Color     string  `json:"color"`
		Quantity  int     `json:"quantity"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	cartToken := body.CartToken
	if cartToken == "" {
		token, err := catalog.NewCartToken()
		if err != nil {
			response.Err(w, apierror.ErrInternal)
			return
		}
		cartToken = token
	}

	productID, err := parseUUID(body.ProductID)
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var fabricID *uuid.UUID
	if body.FabricID != nil && *body.FabricID != "" {
		id, err := parseUUID(*body.FabricID)
		if err != nil {
			response.Err(w, apierror.ErrValidation)
			return
		}
		fabricID = &id
	}

	if body.Quantity <= 0 {
		body.Quantity = 1
	}

	item, err := s.cart.AddItem(r.Context(), t.ID, catalog.AddItemInput{
		CartToken: cartToken,
		ProductID: productID,
		FabricID:  fabricID,
		Size:      body.Size,
		Color:     body.Color,
		Quantity:  body.Quantity,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{
		"cart_token": cartToken,
		"item":       item,
	})
}

func (s *Server) handleRemoveCartItem(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	itemID, err := parseUUID(chi.URLParam(r, "itemID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}
	cartToken := r.URL.Query().Get("cart_token")
	if cartToken == "" {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.cart.RemoveItem(r.Context(), t.ID, cartToken, itemID); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Reviews --------------------------------------------------------------

func (s *Server) handleCreateReview(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		OrderID    *string         `json:"order_id"`
		CustomerID *string         `json:"customer_id"`
		Rating     int             `json:"rating"`
		Comment    string          `json:"comment"`
		PhotoURLs  json.RawMessage `json:"photo_urls"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var orderID, customerID *uuid.UUID
	if body.OrderID != nil && *body.OrderID != "" {
		id, err := parseUUID(*body.OrderID)
		if err != nil {
			response.Err(w, apierror.ErrValidation)
			return
		}
		orderID = &id
	}
	if body.CustomerID != nil && *body.CustomerID != "" {
		id, err := parseUUID(*body.CustomerID)
		if err != nil {
			response.Err(w, apierror.ErrValidation)
			return
		}
		customerID = &id
	}

	rev, err := s.reviews.Create(r.Context(), t.ID, catalog.CreateReviewInput{
		OrderID:    orderID,
		CustomerID: customerID,
		Rating:     body.Rating,
		Comment:    body.Comment,
		PhotoURLs:  body.PhotoURLs,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, rev)
}

func (s *Server) handleListPublishedReviews(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	reviews, err := s.reviews.ListPublished(r.Context(), t.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, reviews)
}

func (s *Server) handleListPendingReviews(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	reviews, err := s.reviews.ListPending(r.Context(), t.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, reviews)
}

func (s *Server) handlePublishReview(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	reviewID, err := parseUUID(chi.URLParam(r, "reviewID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.reviews.Publish(r.Context(), t.ID, reviewID); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleDeleteReview rejects/removes a review — there is no "rejected"
// status in the schema (see internal/catalog/reviews.go Delete), so
// rejecting a pending review (or pulling down one already published) is
// modeled as a hard delete.
func (s *Server) handleDeleteReview(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	reviewID, err := parseUUID(chi.URLParam(r, "reviewID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.reviews.Delete(r.Context(), t.ID, reviewID); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
