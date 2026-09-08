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
	"github.com/abmcy/core/pkg/apierror"
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
	// corsOrigins is the CORS_ORIGINS env var, split — used only as a
	// fallback for origins that have never been set in platform_config
	// (fresh deploy, or before an operator has configured any tenant
	// storefront domain). See corsMiddleware.
	corsOrigins []string
	adminAPIKey string
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
	r.Post("/auth/login", s.handleLogin) // personnel tenant — X-API-Key reste aussi valide sur les routes métier ci-dessous
	r.Post("/admin/auth/login", s.handleAdminLogin)
	r.Post("/webhooks/cinetpay/{tenantSlug}", s.handleCinetPayWebhook)

	// Authentification des clients finaux d'un tenant (ex: les acheteurs
	// de HANI'S) — troisième public, distinct du personnel tenant
	// (X-API-Key) et du super-admin ABMCY. Identifié par tenant_slug dans
	// le corps de la requête puisqu'un client final n'a pas de clé API.
	r.Post("/auth/customer/register", s.handleCustomerRegister)
	r.Post("/auth/customer/login", s.handleCustomerLogin)
	r.Post("/auth/customer/forgot-password", s.handleCustomerForgotPassword)
	r.Post("/auth/customer/reset-password", s.handleCustomerResetPassword)

	r.Group(func(r chi.Router) {
		r.Use(s.customerAuth)
		r.Post("/auth/customer/logout", s.handleCustomerLogout)
		r.Get("/auth/customer/me", s.handleCustomerMe)
		r.Patch("/auth/customer/me", s.handleCustomerUpdateMe)
	})

	// Tenant-scoped API — accepts EITHER X-API-Key (external integrations,
	// e.g. a tenant's own website) OR a staff JWT (a human logged into
	// tenant-dashboard via /auth/login). Two audiences, same routes.
	r.Group(func(r chi.Router) {
		r.Use(s.staffAuth)
		r.Use(authmw.TrafficLog(s.pool)) // after staffAuth: needs tenant context; wraps RateLimit to log rejections too
		if rl != nil {
			r.Use(rl.Middleware)
		}

		r.Get("/features", s.handleGetFeatures)

		r.Group(func(r chi.Router) {
			r.Use(s.requireStaffJWT)
			r.Post("/auth/logout", s.handleStaffLogout)
			r.Get("/staff", s.handleListStaff)
			r.Post("/staff", s.handleCreateStaff)
			r.Put("/staff/{userID}/active", s.handleSetStaffActive)
		})

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
			r.Patch("/products/{productID}", s.handleUpdateProduct)

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

		r.Get("/admin/accounts", s.handleAdminListAccounts)
		r.Post("/admin/accounts", s.handleAdminCreateAccount)
		r.Put("/admin/accounts/{userID}/active", s.handleAdminSetAccountActive)

		r.Get("/admin/tenants", s.handleAdminListTenants)
		r.Post("/admin/tenants", s.handleAdminCreateTenant)
		r.Put("/admin/tenants/{tenantID}/rate-limit", s.handleAdminUpdateRateLimit)
		r.Put("/admin/tenants/{tenantID}/business-type", s.handleAdminUpdateBusinessType)
		r.Put("/admin/tenants/{tenantID}/profile", s.handleAdminUpdateTenantProfile)
		r.Get("/admin/tenants/{tenantID}/socials", s.handleAdminListTenantSocials)
		r.Put("/admin/tenants/{tenantID}/socials", s.handleAdminSetTenantSocials)
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

// adminAuth accepts either a valid super-admin JWT (Authorization: Bearer
// ..., issued by POST /admin/auth/login) or the static X-Admin-Key —
// kept as a bootstrap fallback so a fresh deployment with no admin
// account yet isn't locked out of the dashboard. Once at least one admin
// account exists, the dashboard should use the JWT path exclusively.
type adminClaimsCtxKey struct{}

// adminClaimsFromContext returns the authenticated admin's claims when the
// request came in via JWT login — false when authenticated via the static
// X-Admin-Key instead, which has no individual identity to attach to
// audit fields like platform_config.updated_by.
func adminClaimsFromContext(ctx context.Context) (*auth.AdminClaims, bool) {
	c, ok := ctx.Value(adminClaimsCtxKey{}).(*auth.AdminClaims)
	return c, ok
}

func (s *Server) adminAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			token := strings.TrimPrefix(auth, "Bearer ")
			if claims, err := s.authSvc.ParseAdminToken(token); err == nil {
				ctx := context.WithValue(r.Context(), adminClaimsCtxKey{}, claims)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		key := r.Header.Get("X-Admin-Key")
		if key != "" && key == s.adminAPIKey {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, `{"error":{"code":"forbidden","message":"Accès refusé."}}`, http.StatusForbidden)
	})
}

type staffClaimsCtxKey struct{}

// staffAuth accepts either a valid staff JWT (Authorization: Bearer ...,
// issued by POST /auth/login — a human using tenant-dashboard) or the
// tenant's X-API-Key (an external integration, e.g. the tenant's own
// website). Both grant the same tenant-scoped access; only the JWT path
// additionally identifies which staff member is acting (see
// requireStaffJWT for routes that need that, like /staff management).
func (s *Server) staffAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			token := strings.TrimPrefix(auth, "Bearer ")
			// A JWT always contains two dots (header.payload.signature);
			// an API key (pk_live_...) never does — cheap way to avoid
			// trying to JWT-parse an API key on every request.
			if strings.Count(token, ".") == 2 {
				if claims, err := s.authSvc.ParseToken(r.Context(), token); err == nil {
					t, err := authmw.LookupByID(r.Context(), s.pool, claims.TenantID)
					if err == nil && t.Active {
						t.StaffUserID = &claims.UserID
						t.StaffRole = claims.Role
						ctx := context.WithValue(r.Context(), staffClaimsCtxKey{}, claims)
						ctx = authmw.WithTenant(ctx, t)
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
				response.Err(w, apierror.ErrUnauthorized)
				return
			}
		}

		authmw.TenantAuth(s.pool)(next).ServeHTTP(w, r)
	})
}

// requireStaffJWT rejects requests authenticated only by X-API-Key —
// for routes where "which human is doing this" must be known (logout,
// team management), an API key integration has no such identity to give.
func (s *Server) requireStaffJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t, _ := authmw.TenantFromContext(r.Context())
		if t.StaffUserID == nil {
			response.Err(w, apierror.New(403, "staff_login_required",
				"Cette action nécessite une connexion via le dashboard (email/mot de passe), pas une clé API."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func staffClaimsFromContext(ctx context.Context) (*auth.Claims, bool) {
	c, ok := ctx.Value(staffClaimsCtxKey{}).(*auth.Claims)
	return c, ok
}

type customerCtxKey struct{}

// customerAuth identifies the calling end customer from their JWT
// (Authorization: Bearer ..., issued by /auth/customer/login or
// /register) and attaches their claims to the request context. Distinct
// from TenantAuth (X-API-Key, tenant staff) — a customer token must never
// grant access to tenant-management routes.
func (s *Server) customerAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			response.Err(w, apierror.ErrUnauthorized)
			return
		}

		claims, err := s.authSvc.ParseCustomerToken(r.Context(), strings.TrimPrefix(auth, "Bearer "))
		if err != nil {
			response.Err(w, apierror.ErrUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), customerCtxKey{}, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func customerFromContext(ctx context.Context) (*auth.CustomerClaims, bool) {
	c, ok := ctx.Value(customerCtxKey{}).(*auth.CustomerClaims)
	return c, ok
}

// allowedCorsOrigins prefers platform_config (editable from the admin
// dashboard's Configuration page, live — no redeploy needed to onboard a
// new tenant storefront) and falls back to the CORS_ORIGINS env var only
// when that key has never been set.
func (s *Server) allowedCorsOrigins() []string {
	if v, ok := s.config.Get(platformconfig.KeyCorsOrigins); ok {
		return strings.Split(v, ",")
	}
	return s.corsOrigins
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, allowed := range s.allowedCorsOrigins() {
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
	return authmw.LookupBySlug(ctx, s.pool, slug)
}

// resolveTenantSlug picks the tenant slug for a public request (customer
// auth, staff login): the subdomain of api.abmcy.com if the request came
// in on one (e.g. hanis.api.abmcy.com), otherwise the tenant_slug the
// client put in the request body. The subdomain wins when both are
// present, on the assumption that a request literally arriving on
// hanis.api.abmcy.com is unambiguously about hanis — this is purely a
// convenience for identifying WHICH tenant, never a substitute for the
// X-API-Key/JWT checks that follow on every actual data-access route.
func resolveTenantSlug(r *http.Request, bodySlug string) string {
	if slug, ok := authmw.SlugFromHost(r.Host); ok {
		return slug
	}
	return bodySlug
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
