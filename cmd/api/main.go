// Command api boots the ABMCY Core Multi-Tenant backend: a single Go
// binary (modulith) exposing every service — tenants, auth, catalog,
// orders, storage (imgbb), payments (CinetPay), notifications (Resend)
// — behind one HTTP router. Deployed on the VPS behind api.abmcy.com;
// the frontend dashboards (dash.abmcy.com, ad.abmcy.com) live separately
// on Vercel and talk to this API over HTTPS.
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
	authmw "github.com/abmcy/core/internal/middleware"
	"github.com/abmcy/core/internal/httpserver"
	"github.com/abmcy/core/internal/notification"
	"github.com/abmcy/core/internal/order"
	"github.com/abmcy/core/internal/payment"
	"github.com/abmcy/core/internal/storage"
	"github.com/abmcy/core/internal/tenant"
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

	// Wire services.
	tenants := tenant.NewService(pool)
	authSvc := auth.NewService(pool, cfg.JWTSecret)
	orders := order.NewService(pool)

	imgbb := storage.NewImgBBClient(cfg.ImgBBAPIKey)
	storageSvc := storage.NewService(pool, imgbb)

	cinetpay := payment.NewCinetPayClient(cfg.CinetPayAPIKey, cfg.CinetPaySiteID)
	payments := payment.NewService(pool, cinetpay, orders)

	resend := notification.NewResendClient(cfg.ResendAPIKey, cfg.ResendFromAddr)
	notifications := notification.NewService(pool, resend)

	rateLimiter := authmw.NewRateLimit(5, 20) // 5 req/s soutenu, burst 20, par tenant

	adminKey := os.Getenv("ADMIN_API_KEY")
	if adminKey == "" {
		slog.Warn("ADMIN_API_KEY not set — /admin/* routes are unreachable until it is configured")
	}

	srv := httpserver.New(httpserver.Deps{
		Pool:          pool,
		Tenants:       tenants,
		Auth:          authSvc,
		Orders:        orders,
		Storage:       storageSvc,
		Payments:      payments,
		Notifications: notifications,
		RateLimiter:   rateLimiter,
		PublicBaseURL: "https://api.abmcy.com",
		CorsOrigins:   cfg.CorsOrigins,
		AdminAPIKey:   adminKey,
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
