package config

import (
	"fmt"
	"os"
)

// Config centralizes every environment-driven setting for the whole
// modulith. All services read from here instead of calling os.Getenv
// directly, so the full set of required env vars lives in one place.
type Config struct {
	Env  string // "development" | "production"
	Port string

	DatabaseURL string

	JWTSecret string

	ImgBBAPIKey string // https://api.imgbb.com/ upload key

	ResendAPIKey   string
	ResendFromAddr string // e.g. "ABMCY <no-reply@abmcy.com>"

	// Payment provider credentials (CinetPay covers Wave/OM/MoMo aggregation
	// in most West African setups; Stripe kept for international cards).
	CinetPayAPIKey string
	CinetPaySiteID string
	StripeSecret   string

	CorsOrigins string // comma separated, e.g. https://dash.abmcy.com,https://ad.abmcy.com
}

func Load() (*Config, error) {
	cfg := &Config{
		Env:  getEnv("APP_ENV", "development"),
		Port: getEnv("PORT", "8080"),

		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),

		ImgBBAPIKey: os.Getenv("IMGBB_API_KEY"),

		ResendAPIKey:   os.Getenv("RESEND_API_KEY"),
		ResendFromAddr: getEnv("RESEND_FROM_ADDR", "ABMCY <no-reply@abmcy.com>"),

		CinetPayAPIKey: os.Getenv("CINETPAY_API_KEY"),
		CinetPaySiteID: os.Getenv("CINETPAY_SITE_ID"),
		StripeSecret:   os.Getenv("STRIPE_SECRET_KEY"),

		CorsOrigins: getEnv("CORS_ORIGINS", "https://dash.abmcy.com,https://ad.abmcy.com"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.ImgBBAPIKey == "" {
		return nil, fmt.Errorf("IMGBB_API_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
