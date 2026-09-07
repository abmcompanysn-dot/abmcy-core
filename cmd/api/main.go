// Command api boots the ABMCY Core Multi-Tenant backend: a single Go
// binary (modulith) exposing every service — tenants, auth, catalog,
// orders, storage (Cloudflare R2), payments (CinetPay), notifications
// (Resend) — behind one HTTP router. Deployed on the VPS behind
// api.abmcy.com; the frontend dashboards (dash.abmcy.com, ad.abmcy.com)
// live separately on Vercel and talk to this API over HTTPS.
//
// Service credentials (R2, Resend, CinetPay) are NOT required at startup:
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
	"github.com/abmcy/core/internal/config"
	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/httpserver"
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/internal/notification"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/payment"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/internal/storage"
	"github.com/abmcy/core/internal/tenant"
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

	// Wire services.
	tenants := tenant.NewService(pool)
	authSvc := auth.NewService(pool, cfg.JWTSecret)
	orders := order.NewService(pool)
	storageSvc := storage.NewService(pool, platformCfg)
	payments := payment.NewService(pool, platformCfg, orders)
	notifications := notification.NewService(pool, platformCfg)
	trafficSvc := traffic.NewService(pool)

	rateLimiter := authmw.NewRateLimit(5, 20) // repli par défaut si un tenant n'a pas ses propres limites

	srv := httpserver.New(httpserver.Deps{
		Pool:          pool,
		Tenants:       tenants,
		Auth:          authSvc,
		Orders:        orders,
		Storage:       storageSvc,
		Payments:      payments,
		Notifications: notifications,
		Config:        platformCfg,
		Traffic:       trafficSvc,
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
