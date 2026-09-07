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

	// Cloudflare R2 (S3-compatible object storage for product/fabric images).
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2PublicURL       string // e.g. "https://img.abmcy.com", no trailing slash

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

		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2PublicURL:       os.Getenv("R2_PUBLIC_URL"),

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
	if cfg.R2AccountID == "" || cfg.R2AccessKeyID == "" || cfg.R2SecretAccessKey == "" || cfg.R2Bucket == "" || cfg.R2PublicURL == "" {
		return nil, fmt.Errorf("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL are all required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
