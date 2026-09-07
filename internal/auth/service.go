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

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, apierror.ErrUnauthorized
	}
	return claims, nil
}
