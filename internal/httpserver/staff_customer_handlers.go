package httpserver

import (
	"net/http"

	"github.com/abmcy/core/internal/catalog"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
	"github.com/go-chi/chi/v5"
)

// --- Clients finaux, vus côté tenant (staff) -----------------------------
//
// Distinct de internal/httpserver/customer_auth_handlers.go, qui sert les
// clients eux-mêmes (/auth/customer/*). Ici c'est le personnel du tenant
// qui consulte et corrige le dossier d'un client — toujours accessible,
// aucun feature flag, réservé au JWT staff (requireStaffJWT).

func (s *Server) handleListCustomers(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	customers, err := s.customers.List(r.Context(), t.ID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, customers)
}

func (s *Server) handleGetCustomer(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	customerID, err := parseUUID(chi.URLParam(r, "customerID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	customer, err := s.customers.Get(r.Context(), t.ID, customerID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, customer)
}

func (s *Server) handleUpdateCustomer(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	customerID, err := parseUUID(chi.URLParam(r, "customerID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		Name            *string `json:"name"`
		Phone           *string `json:"phone"`
		Email           *string `json:"email"`
		ShippingAddress *string `json:"shipping_address"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	customer, err := s.customers.Update(r.Context(), t.ID, customerID, catalog.UpdateInput{
		Name:            body.Name,
		Phone:           body.Phone,
		Email:           body.Email,
		ShippingAddress: body.ShippingAddress,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, customer)
}

func (s *Server) handleStaffSetCustomerPassword(w http.ResponseWriter, r *http.Request) {
	t, _ := authmw.TenantFromContext(r.Context())
	customerID, err := parseUUID(chi.URLParam(r, "customerID"))
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	var body struct {
		NewPassword string `json:"new_password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.authSvc.StaffSetCustomerPassword(r.Context(), t.ID, customerID, body.NewPassword); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
