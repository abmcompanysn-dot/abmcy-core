package httpserver

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/abmcy/core/internal/catalog"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(dst)
}

// --- Orders ---------------------------------------------------------

func (s *Server) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		CustomerName  string          `json:"customer_name"`
		CustomerPhone string          `json:"customer_phone"`
		CustomerEmail string          `json:"customer_email"`
		TotalAmount   int             `json:"total_amount"`
		Measurements  json.RawMessage `json:"measurements"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	o, err := s.orders.Create(r.Context(), t.ID, order.CreateInput{
		CustomerName:  body.CustomerName,
		CustomerPhone: body.CustomerPhone,
		CustomerEmail: body.CustomerEmail,
		TotalAmount:   body.TotalAmount,
		Measurements:  body.Measurements,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, o)
}

func (s *Server) handleListOrders(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	orders, err := s.orders.List(r.Context(), t.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, orders)
}

func (s *Server) handleGetOrder(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	orderID, err := parseUUID(chi.URLParam(r, "orderID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	o, err := s.orders.Get(r.Context(), t.ID, orderID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (s *Server) handleUpdateOrder(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	orderID, err := parseUUID(chi.URLParam(r, "orderID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		ShippingAddress *string         `json:"shipping_address"`
		Measurements    json.RawMessage `json:"measurements"`
		Notes           *string         `json:"notes"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	o, err := s.orders.Update(r.Context(), t.ID, orderID, order.UpdateInput{
		ShippingAddress: body.ShippingAddress,
		Measurements:    body.Measurements,
		Notes:           body.Notes,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (s *Server) handleOrderHistory(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	orderID, err := parseUUID(chi.URLParam(r, "orderID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	history, err := s.orders.History(r.Context(), t.ID, orderID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, history)
}

// handleCreateCustomOrder is the sur-mesure entry point: customer info,
// transmitted measurements, chosen fabric (or how the client will supply
// it), and any particular comments — everything a POST /orders doesn't
// carry on its own.
func (s *Server) handleCreateCustomOrder(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		CustomerName    string          `json:"customer_name"`
		CustomerPhone   string          `json:"customer_phone"`
		CustomerEmail   string          `json:"customer_email"`
		ShippingAddress string          `json:"shipping_address"`
		TotalAmount     int             `json:"total_amount"`
		Measurements    json.RawMessage `json:"measurements"`
		FabricID        *string         `json:"fabric_id"`
		FabricSource    string          `json:"fabric_source"` // maison | envoi_photo | conseil_atelier
		Notes           string          `json:"notes"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	customer, err := s.customers.FindOrCreate(r.Context(), t.ID, body.CustomerName, body.CustomerPhone, body.CustomerEmail)
	if err != nil {
		response.Err(w, err)
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

	o, err := s.orders.Create(r.Context(), t.ID, order.CreateInput{
		CustomerID:      &customer.ID,
		CustomerName:    body.CustomerName,
		CustomerPhone:   body.CustomerPhone,
		CustomerEmail:   body.CustomerEmail,
		ShippingAddress: body.ShippingAddress,
		TotalAmount:     body.TotalAmount,
		Measurements:    body.Measurements,
		FabricID:        fabricID,
		FabricSource:    body.FabricSource,
		Notes:           body.Notes,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, o)
}

func (s *Server) handleSaveMeasurements(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		CustomerName  string          `json:"customer_name"`
		CustomerPhone string          `json:"customer_phone"`
		Gender        string          `json:"gender"`
		Values        json.RawMessage `json:"values"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	customer, err := s.customers.FindOrCreate(r.Context(), t.ID, body.CustomerName, body.CustomerPhone, "")
	if err != nil {
		response.Err(w, err)
		return
	}

	m, err := s.measurements.Save(r.Context(), t.ID, catalog.SaveMeasurementInput{
		CustomerID: customer.ID,
		Gender:     body.Gender,
		Values:     body.Values,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, m)
}

// --- Storage / R2 uploads -----------------------------------------

const maxUploadBytes = 25 << 20 // 25 MB per file, generous headroom for product photos

func (s *Server) handleUploadImage(w http.ResponseWriter, r *http.Request) {
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
	response.JSON(w, http.StatusCreated, img)
}

// --- Payments ---------------------------------------------------------

func (s *Server) handleInitPayment(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		OrderID       string `json:"order_id"`
		Amount        int    `json:"amount"`
		CustomerName  string `json:"customer_name"`
		CustomerPhone string `json:"customer_phone"`
		ReturnURL     string `json:"return_url"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	orderID, err := parseUUID(body.OrderID)
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	notifyURL := s.publicBaseURL + "/webhooks/cinetpay"
	result, err := s.payments.InitiateForOrder(r.Context(), t.ID, orderID, body.Amount, body.CustomerName, body.CustomerPhone, body.ReturnURL, notifyURL)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, result)
}

func (s *Server) handleCinetPayWebhook(w http.ResponseWriter, r *http.Request) {
	// CinetPay posts form-encoded data; tenant is recovered from the
	// transaction ref we generated ourselves at InitiateForOrder time.
	if err := r.ParseForm(); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}
	txRef := r.FormValue("cpm_trans_id")
	tenantSlug := chi.URLParam(r, "tenantSlug")

	t, err := s.lookupTenantBySlug(r.Context(), tenantSlug)
	if err != nil {
		response.Err(w, apierror.ErrNotFound)
		return
	}

	if err := s.payments.HandleWebhook(r.Context(), t.ID, txRef); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// --- Notifications ------------------------------------------------------

func (s *Server) handleSendEmail(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())

	var body struct {
		To       string `json:"to"`
		Subject  string `json:"subject"`
		HTML     string `json:"html"`
		Template string `json:"template"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.notifications.SendEmail(r.Context(), t.ID, body.To, body.Subject, body.HTML, body.Template); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// --- Auth ---------------------------------------------------------------

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TenantSlug string `json:"tenant_slug"`
		Email      string `json:"email"`
		Password   string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	t, err := s.lookupTenantBySlug(r.Context(), body.TenantSlug)
	if err != nil {
		response.Err(w, apierror.ErrUnauthorized)
		return
	}

	token, err := s.authSvc.Login(r.Context(), t.ID, body.Email, body.Password)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"token": token})
}

// --- Super-admin (tenant management) -------------------------------------

func (s *Server) handleAdminListTenants(w http.ResponseWriter, r *http.Request) {
	tenants, err := s.tenants.ListAll(r.Context())
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, tenants)
}

func (s *Server) handleAdminCreateTenant(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	result, err := s.tenants.Create(r.Context(), body.Name, body.Slug)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{
		"tenant":         result.Tenant,
		"api_key_secret": result.APIKeySecret, // shown once — client must store it now
	})
}

func (s *Server) handleAdminUpdateRateLimit(w http.ResponseWriter, r *http.Request) {
	tenantID, err := parseUUID(chi.URLParam(r, "tenantID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		RateLimitPerSec int `json:"rate_limit_per_sec"`
		RateLimitBurst  int `json:"rate_limit_burst"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.tenants.UpdateRateLimit(r.Context(), tenantID, body.RateLimitPerSec, body.RateLimitBurst); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleAdminUpdateFeatures toggles opt-in tenant capabilities — right now
// just the storefront catalog (products, fabrics, cart, gallery, reviews).
// A tenant selling entirely over WhatsApp/in-store can stay without it;
// ABMCY enables it per tenant from the dashboard once they're ready for it.
func (s *Server) handleAdminUpdateFeatures(w http.ResponseWriter, r *http.Request) {
	tenantID, err := parseUUID(chi.URLParam(r, "tenantID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		CatalogEnabled bool `json:"catalog_enabled"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.features.SetCatalogEnabled(r.Context(), tenantID, body.CatalogEnabled); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAdminGetFeatures(w http.ResponseWriter, r *http.Request) {
	tenantID, err := parseUUID(chi.URLParam(r, "tenantID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	flags, err := s.features.Get(r.Context(), tenantID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, flags)
}

// handleGetFeatures lets a tenant's own dashboard know whether the
// catalog is enabled for them, without needing admin access.
func (s *Server) handleGetFeatures(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	flags, err := s.features.Get(r.Context(), t.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, flags)
}

// --- Super-admin (platform configuration: R2, Resend, CinetPay) ---------

func (s *Server) handleAdminGetConfig(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, s.config.StatusAll())
}

func (s *Server) handleAdminSetConfig(w http.ResponseWriter, r *http.Request) {
	key := platformconfig.Key(chi.URLParam(r, "key"))

	valid := false
	for _, k := range platformconfig.AllKeys {
		if k == key {
			valid = true
			break
		}
	}
	if !valid {
		response.Err(w, apierror.New(404, "unknown_config_key", "Clé de configuration inconnue."))
		return
	}

	var body struct {
		Value string `json:"value"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	// updatedBy is left as the zero UUID until admin dashboard accounts
	// exist (see internal/auth) — platform_config.updated_by is nullable
	// and this is filled in properly once admin users are real rows.
	if err := s.config.Set(r.Context(), key, body.Value, uuid.Nil); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Super-admin (traffic) -----------------------------------------------

func (s *Server) handleAdminTrafficSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := s.traffic.SummaryLast24h(r.Context())
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, summary)
}

func (s *Server) handleAdminTrafficDetail(w http.ResponseWriter, r *http.Request) {
	tenantID, err := parseUUID(chi.URLParam(r, "tenantID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	recent, err := s.traffic.RecentForTenant(r.Context(), tenantID, 100)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, recent)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
