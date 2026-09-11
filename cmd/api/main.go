// Command api boots the ABMCY Core Multi-Tenant backend: a single Go
// binary (modulith) exposing every service — tenants, auth, catalog,
// orders, storage (Cloudflare R2), payments (ABMCY Core Payment, per-tenant), notifications
// (Resend) — behind one HTTP router. Deployed on the VPS behind
// api.abmcy.com; the frontend dashboards (dash.abmcy.com, ad.abmcy.com)
// live separately on Vercel and talk to this API over HTTPS.
//
// Service credentials (R2, Resend) are NOT required at startup:
// they're managed at runtime via internal/platformconfig and set from the
// super-admin dashboard's Configuration page. A fresh deploy boots with
// none of them configured; the features that need them answer a clear
// 503 until an operator fills them in — see internal/platformconfig.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/abmcy/core/internal/auth"
	"github.com/abmcy/core/internal/catalog"
	"github.com/abmcy/core/internal/config"
	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/features"
	"github.com/abmcy/core/internal/httpserver"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/internal/notification"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/payment"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/internal/storage"
	"github.com/abmcy/core/internal/tenant"
	"github.com/abmcy/core/internal/tenantpayment"
	"github.com/abmcy/core/internal/traffic"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config: load failed", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("db: open failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	platformCfg, err := platformconfig.NewService(pool, cfg.ConfigEncryptionKey)
	if err != nil {
		slog.Error("platformconfig: init failed", "error", err)
		os.Exit(1)
	}
	if err := platformCfg.Load(ctx); err != nil {
		slog.Error("platformconfig: initial load failed", "error", err)
		os.Exit(1)
	}
	// With more than one API replica, each pod's cache only reflects the
	// writes it personally handled — without this, another pod would
	// answer "not configured" forever for a key set on a different
	// replica. See platformconfig.Service.StartAutoRefresh.
	platformCfg.StartAutoRefresh(ctx, 15*time.Second)

	// Wire services.
	tenants := tenant.NewService(pool)
	authSvc := auth.NewService(pool, cfg.JWTSecret)
	orders := order.NewService(pool)
	storageSvc := storage.NewService(pool, platformCfg)
	tenantPayment, err := tenantpayment.NewService(pool, cfg.ConfigEncryptionKey, "https://core.diarra.app")
	if err != nil {
		slog.Error("tenantpayment: init failed", "error", err)
		os.Exit(1)
	}
	payments := payment.NewService(pool, tenantPayment, orders)
	notifications := notification.NewService(pool, platformCfg)
	trafficSvc := traffic.NewService(pool)
	featuresSvc := features.NewService(pool)

	// Catalogue optionnel (activé par tenant via internal/features) :
	// produits, tissus, clients, mesures, panier, galerie, avis.
	products := catalog.NewProductService(pool)
	fabrics := catalog.NewFabricService(pool)
	customers := catalog.NewCustomerService(pool)
	measurements := catalog.NewMeasurementService(pool)
	cart := catalog.NewCartService(pool)
	gallery := catalog.NewGalleryService(pool)
	reviews := catalog.NewReviewService(pool)

	rateLimiter := authmw.NewRateLimit(5, 20) // repli par défaut si un tenant n'a pas ses propres limites

	srv := httpserver.New(httpserver.Deps{
		Pool:          pool,
		Tenants:       tenants,
		Auth:          authSvc,
		Orders:        orders,
		Storage:       storageSvc,
		Payments:      payments,
		TenantPayment: tenantPayment,
		Notifications: notifications,
		Config:        platformCfg,
		Traffic:       trafficSvc,
		Features:      featuresSvc,
		Products:      products,
		Fabrics:       fabrics,
		Customers:     customers,
		Measurements:  measurements,
		Cart:          cart,
		Gallery:       gallery,
		Reviews:       reviews,
		RateLimiter:   rateLimiter,
		PublicBaseURL: "https://api.abmcy.com",
		CorsOrigins:   cfg.CorsOrigins,
		AdminAPIKey:   cfg.AdminAPIKey,
	})

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		slog.Info("api: listening", "port", cfg.Port, "env", cfg.Env)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("api: server failed", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("api: shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		slog.Error("api: graceful shutdown failed", "error", err)
	}
}
