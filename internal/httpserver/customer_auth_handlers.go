package httpserver

import (
	"log/slog"
	"net/http"

	"github.com/abmcy/core/internal/auth"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/abmcy/core/pkg/response"
)

// --- Authentification des clients finaux d'un tenant ---------------------
//
// Troisième public, distinct du personnel tenant (X-API-Key) et du
// super-admin ABMCY (adminAuth). Un client final (ex: acheteur chez
// HANI'S) n'a pas de clé API — le tenant est identifié par tenant_slug
// dans le corps des requêtes publiques ; une fois connecté, le tenant_id
// voyage dans les claims du JWT (voir customerAuth), plus besoin de le
// répéter.

func (s *Server) handleCustomerRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TenantSlug string `json:"tenant_slug"`
		Phone      string `json:"phone"`
		Email      string `json:"email"`
		Password   string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	t, err := s.lookupTenantBySlug(r.Context(), body.TenantSlug)
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	token, err := s.authSvc.RegisterCustomer(r.Context(), t.ID, body.Phone, body.Email, body.Password)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]string{"token": token})
}

func (s *Server) handleCustomerLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TenantSlug string `json:"tenant_slug"`
		Phone      string `json:"phone"`
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

	token, err := s.authSvc.LoginCustomer(r.Context(), t.ID, body.Phone, body.Password)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"token": token})
}

func (s *Server) handleCustomerForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TenantSlug string `json:"tenant_slug"`
		Email      string `json:"email"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	t, err := s.lookupTenantBySlug(r.Context(), body.TenantSlug)
	if err != nil {
		// Réponse identique que le tenant existe ou non — pas de fuite
		// d'information sur la structure interne via cet endpoint public.
		response.JSON(w, http.StatusOK, map[string]string{
			"message": "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
		})
		return
	}

	_, plaintextToken, found, err := s.authSvc.RequestPasswordReset(r.Context(), t.ID, body.Email)
	if err != nil {
		response.Err(w, err)
		return
	}

	if found {
		resetURL := "https://dash.abmcy.com/" + t.Slug + "/reset-password?token=" + plaintextToken
		html := "<p>Vous avez demandé la réinitialisation de votre mot de passe.</p>" +
			"<p><a href=\"" + resetURL + "\">Cliquez ici pour choisir un nouveau mot de passe</a> (valable 1 heure).</p>" +
			"<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>"
		// Best-effort côté client : un email non configuré/en échec ne
		// doit ni empêcher la réponse générique de partir, ni révéler que
		// le compte existe. Mais l'échec est réel et doit être visible côté
		// ABMCY (email_logs l'enregistre déjà en "failed" ; on logge aussi
		// ici pour que ça remonte dans les logs applicatifs/du pod).
		if sendErr := s.notifications.SendEmail(r.Context(), t.ID, body.Email, "Réinitialisation de votre mot de passe", html, "password_reset"); sendErr != nil {
			slog.Error("password reset email failed to send", "tenant_id", t.ID, "error", sendErr)
		}
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
	})
}

func (s *Server) handleCustomerResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TenantSlug  string `json:"tenant_slug"`
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	t, err := s.lookupTenantBySlug(r.Context(), body.TenantSlug)
	if err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	if err := s.authSvc.ResetPassword(r.Context(), t.ID, body.Token, body.NewPassword); err != nil {
		response.Err(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleCustomerLogout(w http.ResponseWriter, r *http.Request) {
	claims, _ := customerFromContext(r.Context())
	if claims != nil {
		if err := s.authSvc.LogoutCustomer(r.Context(), claims); err != nil {
			response.Err(w, err)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleCustomerMe(w http.ResponseWriter, r *http.Request) {
	claims, _ := customerFromContext(r.Context())
	profile, err := s.authSvc.GetCustomerProfile(r.Context(), claims.TenantID, claims.CustomerID)
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, profile)
}

func (s *Server) handleCustomerUpdateMe(w http.ResponseWriter, r *http.Request) {
	claims, _ := customerFromContext(r.Context())

	var body struct {
		Name            *string `json:"name"`
		Email           *string `json:"email"`
		ShippingAddress *string `json:"shipping_address"`
	}
	if err := decodeJSON(r, &body); err != nil {
		response.Err(w, apierror.ErrValidation)
		return
	}

	profile, err := s.authSvc.UpdateCustomerProfile(r.Context(), claims.TenantID, claims.CustomerID, auth.UpdateCustomerProfileInput{
		Name:            body.Name,
		Email:           body.Email,
		ShippingAddress: body.ShippingAddress,
	})
	if err != nil {
		response.Err(w, err)
		return
	}
	response.JSON(w, http.StatusOK, profile)
}
