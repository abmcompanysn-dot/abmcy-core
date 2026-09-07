package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	pool      *db.Pool
	jwtSecret []byte
}

func NewService(pool *db.Pool, jwtSecret string) *Service {
	return &Service{pool: pool, jwtSecret: []byte(jwtSecret)}
}

type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Role     string    `json:"role"`
	jwt.RegisteredClaims
}

// Login checks credentials scoped to a tenant (dash.abmcy.com/<slug>) and
// returns a signed JWT the frontend stores and sends as Authorization:
// Bearer <token> for subsequent dashboard calls.
func (s *Service) Login(ctx context.Context, tenantID uuid.UUID, email, password string) (string, error) {
	var userID uuid.UUID
	var role, hash string

	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `SELECT id, role, password_hash FROM users WHERE tenant_id = $1 AND email = $2 AND is_active`, tenantID, email)
		return row.Scan(&userID, &role, &hash)
	})
	if err != nil {
		return "", apierror.ErrUnauthorized
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", apierror.ErrUnauthorized
	}

	claims := Claims{
		UserID:   userID,
		TenantID: tenantID,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(), // jti — permet la révocation précise au logout
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("auth: sign token: %w", err)
	}
	return signed, nil
}

// ParseToken validates signature, expiry, and that the token hasn't been
// revoked via Logout — a plain JWT otherwise stays valid until its
// natural expiry regardless of logout.
func (s *Service) ParseToken(ctx context.Context, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, apierror.ErrUnauthorized
	}
	if claims.ID != "" {
		revoked, err := s.isTokenRevoked(ctx, claims.ID)
		if err != nil {
			return nil, fmt.Errorf("auth: check revocation: %w", err)
		}
		if revoked {
			return nil, apierror.ErrUnauthorized
		}
	}
	return claims, nil
}

// Logout revokes one staff token by its jti (see internal/auth/customer.go
// for the identical mechanism on the customer side — a JWT can't be
// invalidated before its own expiry without this kind of server-side state).
func (s *Service) Logout(ctx context.Context, claims *Claims) error {
	if claims.ID == "" || claims.ExpiresAt == nil {
		return nil
	}
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2)
			ON CONFLICT (jti) DO NOTHING
		`, claims.ID, claims.ExpiresAt.Time)
		return err
	})
}

// StaffUser is a tenant staff account as exposed to the tenant dashboard
// — no password hash, ever.
type StaffUser struct {
	ID       uuid.UUID `json:"id"`
	Email    string    `json:"email"`
	Role     string    `json:"role"` // owner | staff
	IsActive bool      `json:"is_active"`
}

// CreateStaffUser provisions a new tenant staff account (e.g. HANI'S
// adding a seamstress or shop manager). Role defaults to "staff" — only
// an "owner" account should be able to grant "owner" to someone else,
// which the caller (httpserver) is responsible for checking.
func (s *Service) CreateStaffUser(ctx context.Context, tenantID uuid.UUID, email, password, role string) (*StaffUser, error) {
	if email == "" || len(password) < 8 {
		return nil, apierror.New(422, "validation_error", "Email requis et mot de passe d'au moins 8 caractères.")
	}
	if role != "owner" && role != "staff" {
		role = "staff"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, apierror.ErrInternal
	}

	var u StaffUser
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO users (tenant_id, email, password_hash, role)
			VALUES ($1, $2, $3, $4)
			RETURNING id, email, role, is_active
		`, tenantID, email, string(hash), role)
		return row.Scan(&u.ID, &u.Email, &u.Role, &u.IsActive)
	})
	if err != nil {
		return nil, fmt.Errorf("auth: create staff user: %w", err)
	}
	return &u, nil
}

// ListStaffUsers is for the tenant dashboard's own team-management page.
func (s *Service) ListStaffUsers(ctx context.Context, tenantID uuid.UUID) ([]StaffUser, error) {
	var users []StaffUser
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `SELECT id, email, role, is_active FROM users WHERE tenant_id = $1 ORDER BY created_at`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var u StaffUser
			if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.IsActive); err != nil {
				return err
			}
			users = append(users, u)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("auth: list staff users: %w", err)
	}
	return users, nil
}

// SetStaffUserActive lets an owner deactivate a teammate's account
// (someone leaving HANI'S) without deleting the row or its order history
// attribution.
func (s *Service) SetStaffUserActive(ctx context.Context, tenantID, userID uuid.UUID, active bool) error {
	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `UPDATE users SET is_active = $1 WHERE id = $2 AND tenant_id = $3`, active, userID, tenantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}
