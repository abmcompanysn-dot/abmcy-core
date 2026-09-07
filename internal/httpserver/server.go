package httpserver

import (
	"context"
	"net/http"
	"strings"

	"github.com/abmcy/core/internal/auth"
	"github.com/abmcy/core/internal/catalog"
	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/features"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/internal/notification"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/payment"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/internal/storage"
	"github.com/abmcy/core/internal/tenant"
	"github.com/abmcy/core/internal/traffic"
	"github.com/abmcy/core/pkg/response"
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
	config        *platformconfig.Service
	traffic       *traffic.Service
	features      *features.Service

	products     *catalog.ProductService
	fabrics      *catalog.FabricService
	customers    *catalog.CustomerService
	measurements *catalog.MeasurementService
	cart         *catalog.CartService
	gallery      *catalog.GalleryService
	reviews      *catalog.ReviewService

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
	Config        *platformconfig.Service
	Traffic       *traffic.Service
	Features      *features.Service
	Products      *catalog.ProductService
	Fabrics       *catalog.FabricService
	Customers     *catalog.CustomerService
	Measurements  *catalog.MeasurementService
	Cart          *catalog.CartService
	Gallery       *catalog.GalleryService
	Reviews       *catalog.ReviewService
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
		config:        d.Config,
		traffic:       d.Traffic,
		features:      d.Features,
		products:      d.Products,
		fabrics:       d.Fabrics,
		customers:     d.Customers,
		measurements:  d.Measurements,
		cart:          d.Cart,
		gallery:       d.Gallery,
		reviews:       d.Reviews,
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
		r.Use(authmw.TrafficLog(s.pool)) // after TenantAuth: needs tenant context; wraps RateLimit to log rejections too
		if rl != nil {
			r.Use(rl.Middleware)
		}

		r.Get("/features", s.handleGetFeatures)

		r.Post("/orders", s.handleCreateOrder)
		r.Get("/orders", s.handleListOrders)
		r.Get("/orders/{orderID}", s.handleGetOrder)
		r.Patch("/orders/{orderID}", s.handleUpdateOrder)
		r.Get("/orders/{orderID}/history", s.handleOrderHistory)
		r.Post("/custom-orders", s.handleCreateCustomOrder)
		r.Post("/measurements", s.handleSaveMeasurements)
		r.Post("/uploads/image", s.handleUploadImage)
		r.Post("/payments/init", s.handleInitPayment)
		r.Post("/notifications/email", s.handleSendEmail)

		// Service catalogue — opt-in par tenant (voir internal/features).
		// Un tenant sans le catalogue activé reçoit un 403 clair sur
		// toutes ces routes plutôt qu'un comportement à moitié fonctionnel.
		r.Group(func(r chi.Router) {
			r.Use(s.requireCatalog)

			r.Get("/products", s.handleListProducts)
			r.Post("/products", s.handleCreateProduct)
			r.Get("/products/{productID}", s.handleGetProduct)

			r.Get("/fabrics", s.handleListFabrics)
			r.Post("/fabrics", s.handleCreateFabric)
			r.Post("/fabrics/upload", s.handleUploadFabricPhoto)

			r.Get("/gallery", s.handleListGallery)
			r.Post("/gallery", s.handleAddGalleryPhoto)

			r.Get("/cart", s.handleGetCart)
			r.Post("/cart", s.handleAddCartItem)
			r.Delete("/cart/{itemID}", s.handleRemoveCartItem)

			r.Post("/reviews", s.handleCreateReview)
			r.Get("/reviews", s.handleListPublishedReviews)
			r.Get("/reviews/pending", s.handleListPendingReviews)
			r.Post("/reviews/{reviewID}/publish", s.handlePublishReview)
		})
	})

	// Super-admin API — separate static key, used only by ad.abmcy.com's
	// own admin dashboard, never exposed to tenants.
	r.Group(func(r chi.Router) {
		r.Use(s.adminAuth)
		r.Get("/admin/tenants", s.handleAdminListTenants)
		r.Post("/admin/tenants", s.handleAdminCreateTenant)
		r.Put("/admin/tenants/{tenantID}/rate-limit", s.handleAdminUpdateRateLimit)
		r.Put("/admin/tenants/{tenantID}/business-type", s.handleAdminUpdateBusinessType)
		r.Get("/admin/tenants/{tenantID}/features", s.handleAdminGetFeatures)
		r.Put("/admin/tenants/{tenantID}/features", s.handleAdminUpdateFeatures)

		r.Get("/admin/config", s.handleAdminGetConfig)
		r.Put("/admin/config/{key}", s.handleAdminSetConfig)

		r.Get("/admin/traffic", s.handleAdminTrafficSummary)
		r.Get("/admin/traffic/{tenantID}", s.handleAdminTrafficDetail)
	})
}

func (s *Server) requireCatalog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t, _ := authmw.TenantFromContext(r.Context())
		if err := s.features.RequireCatalog(r.Context(), t.ID); err != nil {
			response.Err(w, err)
			return
		}
		next.ServeHTTP(w, r)
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
		row := tx.QueryRow(ctx, `SELECT id, slug, plan, is_active, rate_limit_per_sec, rate_limit_burst FROM tenants WHERE slug = $1`, slug)
		return row.Scan(&t.ID, &t.Slug, &t.Plan, &t.Active, &t.RateLimitPerSec, &t.RateLimitBurst)
	})
	return t, err
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
