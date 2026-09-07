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

// AdminClaims identifies an ABMCY super-admin user — distinct from Claims
// (tenant-scoped) since a super-admin has no tenant_id and must never be
// usable to authenticate as, or access, a tenant.
type AdminClaims struct {
	UserID uuid.UUID `json:"user_id"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

// LoginSuperAdmin checks credentials for a users row with tenant_id NULL
// and role 'super_admin', and returns a signed JWT for the admin
// dashboard. Runs via WithSystem since super-admin accounts aren't scoped
// to any tenant's RLS context.
func (s *Service) LoginSuperAdmin(ctx context.Context, email, password string) (string, error) {
	var userID uuid.UUID
	var hash string

	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			SELECT id, password_hash FROM users
			WHERE tenant_id IS NULL AND email = $1 AND role = 'super_admin' AND is_active
		`, email)
		return row.Scan(&userID, &hash)
	})
	if err != nil {
		return "", apierror.ErrUnauthorized
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", apierror.ErrUnauthorized
	}

	claims := AdminClaims{
		UserID: userID,
		Role:   "super_admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("auth: sign admin token: %w", err)
	}
	return signed, nil
}

func (s *Service) ParseAdminToken(tokenStr string) (*AdminClaims, error) {
	claims := &AdminClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid || claims.Role != "super_admin" {
		return nil, apierror.ErrUnauthorized
	}
	return claims, nil
}

type AdminUser struct {
	ID       uuid.UUID `json:"id"`
	Email    string    `json:"email"`
	IsActive bool      `json:"is_active"`
}

// CreateSuperAdmin provisions a new ABMCY admin account. Called from the
// dashboard by an already-authenticated admin, or via the bootstrap X-Admin-Key
// path when no admin account exists yet.
func (s *Service) CreateSuperAdmin(ctx context.Context, email, password string) (*AdminUser, error) {
	if email == "" || len(password) < 8 {
		return nil, apierror.New(422, "validation_error", "Email requis et mot de passe d'au moins 8 caractères.")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, apierror.ErrInternal
	}

	var u AdminUser
	err = s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO users (tenant_id, email, password_hash, role)
			VALUES (NULL, $1, $2, 'super_admin')
			RETURNING id, email, is_active
		`, email, string(hash))
		return row.Scan(&u.ID, &u.Email, &u.IsActive)
	})
	if err != nil {
		return nil, fmt.Errorf("auth: create super admin: %w", err)
	}
	return &u, nil
}

// ListSuperAdmins is for the admin dashboard's own account-management
// page — see who currently has access.
func (s *Service) ListSuperAdmins(ctx context.Context) ([]AdminUser, error) {
	var users []AdminUser
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `SELECT id, email, is_active FROM users WHERE tenant_id IS NULL AND role = 'super_admin' ORDER BY created_at`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var u AdminUser
			if err := rows.Scan(&u.ID, &u.Email, &u.IsActive); err != nil {
				return err
			}
			users = append(users, u)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("auth: list super admins: %w", err)
	}
	return users, nil
}

// SetSuperAdminActive lets an admin deactivate another admin's account
// (e.g. someone leaving ABMCY) without deleting the row.
func (s *Service) SetSuperAdminActive(ctx context.Context, userID uuid.UUID, active bool) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		tag, err := tx.Exec(ctx, `UPDATE users SET is_active = $1 WHERE id = $2 AND tenant_id IS NULL AND role = 'super_admin'`, active, userID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return apierror.ErrNotFound
		}
		return nil
	})
}
