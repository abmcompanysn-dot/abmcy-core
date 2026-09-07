package httpserver

import (
	"context"
	"net/http"
	"strings"

	"github.com/abmcy/core/internal/auth"
	"github.com/abmcy/core/internal/db"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/internal/notification"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/payment"
	"github.com/abmcy/core/internal/storage"
	"github.com/abmcy/core/internal/tenant"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

type Server struct {
	router *chi.Mux
	pool   *db.Pool

	tenants       *tenant.Service
	authSvc       *auth.Service
	orders        *order.Service
	storage       *storage.Service
	payments      *payment.Service
	notifications *notification.Service

	publicBaseURL string
	corsOrigins   []string
	adminAPIKey   string
}

type Deps struct {
	Pool          *db.Pool
	Tenants       *tenant.Service
	Auth          *auth.Service
	Orders        *order.Service
	Storage       *storage.Service
	Payments      *payment.Service
	Notifications *notification.Service
	RateLimiter   *authmw.RateLimit
	PublicBaseURL string
	CorsOrigins   string
	AdminAPIKey   string // separate, high-privilege key for the super-admin dashboard
}

func New(d Deps) *Server {
	s := &Server{
		router:        chi.NewRouter(),
		pool:          d.Pool,
		tenants:       d.Tenants,
		authSvc:       d.Auth,
		orders:        d.Orders,
		storage:       d.Storage,
		payments:      d.Payments,
		notifications: d.Notifications,
		publicBaseURL: d.PublicBaseURL,
		corsOrigins:   strings.Split(d.CorsOrigins, ","),
		adminAPIKey:   d.AdminAPIKey,
	}
	s.routes(d.RateLimiter)
	return s
}

func (s *Server) Handler() http.Handler { return s.router }

func (s *Server) routes(rl *authmw.RateLimit) {
	r := s.router
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(s.corsMiddleware)

	r.Get("/health", s.handleHealth)
	r.Post("/auth/login", s.handleLogin)
	r.Post("/webhooks/cinetpay/{tenantSlug}", s.handleCinetPayWebhook)

	// Tenant-scoped API — requires X-API-Key, used by dash.abmcy.com clients.
	r.Group(func(r chi.Router) {
		r.Use(authmw.TenantAuth(s.pool))
		if rl != nil {
			r.Use(rl.Middleware)
		}

		r.Post("/orders", s.handleCreateOrder)
		r.Get("/orders", s.handleListOrders)
		r.Post("/uploads/image", s.handleUploadImage)
		r.Post("/payments/init", s.handleInitPayment)
		r.Post("/notifications/email", s.handleSendEmail)
	})

	// Super-admin API — separate static key, used only by cors.abmcy.com's
	// own admin dashboard, never exposed to tenants.
	r.Group(func(r chi.Router) {
		r.Use(s.adminAuth)
		r.Get("/admin/tenants", s.handleAdminListTenants)
		r.Post("/admin/tenants", s.handleAdminCreateTenant)
	})
}

func (s *Server) adminAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-Admin-Key")
		if key == "" || key != s.adminAPIKey {
			http.Error(w, `{"error":{"code":"forbidden","message":"Accès refusé."}}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, allowed := range s.corsOrigins {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				break
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) lookupTenantBySlug(ctx context.Context, slug string) (authmw.Tenant, error) {
	var t authmw.Tenant
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `SELECT id, slug, plan, is_active FROM tenants WHERE slug = $1`, slug)
		return row.Scan(&t.ID, &t.Slug, &t.Plan, &t.Active)
	})
	return t, err
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
