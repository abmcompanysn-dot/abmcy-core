package config

import (
	"fmt"
	"os"
)

// Config centralizes every environment-driven setting for the whole
// modulith. Only the values a server literally cannot boot without live
// here: the database, the JWT signing secret, the key that decrypts
// platform_config, and the bootstrap admin key. Everything else (R2,
// Resend, CinetPay) is managed at runtime via internal/platformconfig and
// set from the super-admin dashboard — a fresh deploy with none of those
// configured still starts; the features that need them just answer 503
// until an operator fills them in.
type Config struct {
	Env  string // "development" | "production"
	Port string

	DatabaseURL string

	JWTSecret string

	// Decrypts/encrypts internal/platformconfig's stored values. Generate
	// with `openssl rand -base64 32`. This is the one credential that
	// really can't live in the database it protects.
	ConfigEncryptionKey string

	// Bootstrap super-admin key, used before any admin user account
	// exists. Kept in the environment rather than platform_config since
	// it gates access to platform_config itself.
	AdminAPIKey string

	CorsOrigins string // comma separated, e.g. https://dash.abmcy.com,https://ad.abmcy.com,https://hani.abmcy.com
}

func Load() (*Config, error) {
	cfg := &Config{
		Env:  getEnv("APP_ENV", "development"),
		Port: getEnv("PORT", "8080"),

		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),

		ConfigEncryptionKey: os.Getenv("CONFIG_ENCRYPTION_KEY"),
		AdminAPIKey:         os.Getenv("ADMIN_API_KEY"),

		CorsOrigins: getEnv("CORS_ORIGINS", "https://dash.abmcy.com,https://ad.abmcy.com,https://hani.abmcy.com"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.ConfigEncryptionKey == "" {
		return nil, fmt.Errorf("CONFIG_ENCRYPTION_KEY is required (generate with: openssl rand -base64 32)")
	}
	if cfg.AdminAPIKey == "" {
		return nil, fmt.Errorf("ADMIN_API_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
