package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// CustomerClaims identifies an end customer of one tenant's storefront
// (e.g. someone buying from HANI'S) — a third, distinct audience from
// Claims (tenant staff) and AdminClaims (ABMCY super-admin). A customer
// JWT is scoped to exactly one tenant and must never grant access to
// tenant-management or admin routes.
type CustomerClaims struct {
	CustomerID uuid.UUID `json:"customer_id"`
	TenantID   uuid.UUID `json:"tenant_id"`
	jwt.RegisteredClaims
}

// CustomerProfile is what GET/PATCH /auth/customer/me exposes — no
// password hash, ever.
type CustomerProfile struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Phone           string    `json:"phone"`
	Email           string    `json:"email,omitempty"`
	ShippingAddress string    `json:"shipping_address,omitempty"`
}

// RegisterCustomer lets an existing customer (created automatically by a
// prior order, see catalog.CustomerService.FindOrCreate) set a password
// for the first time, turning them into someone who can log in and see
// their order history online. Matched by phone within the tenant.
func (s *Service) RegisterCustomer(ctx context.Context, tenantID uuid.UUID, phone, email, password string) (string, error) {
	if phone == "" || len(password) < 8 {
		return "", apierror.New(422, "validation_error", "Téléphone requis et mot de passe d'au moins 8 caractères.")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", apierror.ErrInternal
	}

	var customerID uuid.UUID
	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE customers SET password_hash = $1, email = coalesce(nullif($2, ''), email)
			WHERE tenant_id = $3 AND phone = $4
			RETURNING id
		`, string(hash), email, tenantID, phone)
		return row.Scan(&customerID)
	})
	if err != nil {
		return "", apierror.New(404, "customer_not_found",
			"Aucun profil trouvé pour ce numéro. Passez d'abord une commande, ou contactez le vendeur.")
	}

	return s.signCustomerToken(tenantID, customerID)
}

// LoginCustomer authenticates by phone + password (phone is the primary
// identifier customers already know from ordering — email is optional on
// a customer profile).
func (s *Service) LoginCustomer(ctx context.Context, tenantID uuid.UUID, phone, password string) (string, error) {
	var customerID uuid.UUID
	var hash *string

	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `SELECT id, password_hash FROM customers WHERE tenant_id = $1 AND phone = $2`, tenantID, phone)
		return row.Scan(&customerID, &hash)
	})
	if err != nil || hash == nil {
		return "", apierror.ErrUnauthorized
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*hash), []byte(password)); err != nil {
		return "", apierror.ErrUnauthorized
	}

	return s.signCustomerToken(tenantID, customerID)
}

func (s *Service) signCustomerToken(tenantID, customerID uuid.UUID) (string, error) {
	claims := CustomerClaims{
		CustomerID: customerID,
		TenantID:   tenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),                                        // jti — nécessaire pour pouvoir révoquer précisément ce token au logout
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30 jours : clientèle grand public, pas de ré-auth fréquente attendue
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("auth: sign customer token: %w", err)
	}
	return signed, nil
}

// ParseCustomerToken validates signature, expiry, AND that the token
// hasn't been revoked via Logout — a plain JWT can't be invalidated
// otherwise before its natural expiry.
func (s *Service) ParseCustomerToken(ctx context.Context, tokenStr string) (*CustomerClaims, error) {
	claims := &CustomerClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid || claims.ID == "" {
		return nil, apierror.ErrUnauthorized
	}

	revoked, err := s.isTokenRevoked(ctx, claims.ID)
	if err != nil {
		return nil, fmt.Errorf("auth: check revocation: %w", err)
	}
	if revoked {
		return nil, apierror.ErrUnauthorized
	}
	return claims, nil
}

// Logout revokes one customer token by its jti — recorded until the
// token's own expiry, then it's harmless garbage anyway. This is the only
// way a customer JWT can be invalidated before it naturally expires.
func (s *Service) LogoutCustomer(ctx context.Context, claims *CustomerClaims) error {
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

func (s *Service) isTokenRevoked(ctx context.Context, jti string) (bool, error) {
	var revoked bool
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM revoked_tokens WHERE jti = $1)`, jti)
		return row.Scan(&revoked)
	})
	return revoked, err
}

// GetCustomerProfile backs GET /auth/customer/me.
func (s *Service) GetCustomerProfile(ctx context.Context, tenantID, customerID uuid.UUID) (*CustomerProfile, error) {
	var p CustomerProfile
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			SELECT id, name, phone, coalesce(email, ''), coalesce(shipping_address, '')
			FROM customers WHERE id = $1
		`, customerID)
		return row.Scan(&p.ID, &p.Name, &p.Phone, &p.Email, &p.ShippingAddress)
	})
	if err != nil {
		return nil, apierror.ErrNotFound
	}
	return &p, nil
}

// UpdateCustomerProfileInput carries the fields a customer can edit about
// themselves via PATCH /auth/customer/me.
type UpdateCustomerProfileInput struct {
	Name            *string
	Email           *string
	ShippingAddress *string
}

func (s *Service) UpdateCustomerProfile(ctx context.Context, tenantID, customerID uuid.UUID, in UpdateCustomerProfileInput) (*CustomerProfile, error) {
	var p CustomerProfile
	err := s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			UPDATE customers SET
				name = coalesce($1, name),
				email = coalesce($2, email),
				shipping_address = coalesce($3, shipping_address)
			WHERE id = $4
			RETURNING id, name, phone, coalesce(email, ''), coalesce(shipping_address, '')
		`, in.Name, in.Email, in.ShippingAddress, customerID)
		return row.Scan(&p.ID, &p.Name, &p.Phone, &p.Email, &p.ShippingAddress)
	})
	if err != nil {
		return nil, apierror.ErrNotFound
	}
	return &p, nil
}

// RequestPasswordReset issues a one-time, expiring token and returns it
// in plaintext exactly once — the caller (httpserver) is responsible for
// emailing it via notification.Service, since only that layer has a
// configured Resend client. Only the token's SHA-256 hash is stored, so
// a leaked database dump can't be used to reset accounts.
//
// Always looks like it succeeded even when the email doesn't match any
// customer, so the endpoint can't be used to enumerate registered emails.
func (s *Service) RequestPasswordReset(ctx context.Context, tenantID uuid.UUID, email string) (customerID uuid.UUID, plaintextToken string, found bool, err error) {
	if email == "" {
		return uuid.Nil, "", false, nil
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return uuid.Nil, "", false, fmt.Errorf("auth: generate reset token: %w", err)
	}
	plaintextToken = hex.EncodeToString(tokenBytes)
	hash := sha256.Sum256([]byte(plaintextToken))
	tokenHash := hex.EncodeToString(hash[:])

	err = s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `SELECT id FROM customers WHERE tenant_id = $1 AND email = $2`, tenantID, email)
		if err := row.Scan(&customerID); err != nil {
			found = false
			return nil // no such customer — not an error, caller stays silent about it
		}
		found = true

		_, err := tx.Exec(ctx, `
			INSERT INTO customer_password_resets (tenant_id, customer_id, token_hash, expires_at)
			VALUES ($1, $2, $3, now() + interval '1 hour')
		`, tenantID, customerID, tokenHash)
		return err
	})
	if err != nil {
		return uuid.Nil, "", false, fmt.Errorf("auth: request password reset: %w", err)
	}
	if !found {
		return uuid.Nil, "", false, nil
	}
	return customerID, plaintextToken, true, nil
}

// ResetPassword consumes a reset token (single use, 1h expiry) and sets a
// new password.
func (s *Service) ResetPassword(ctx context.Context, tenantID uuid.UUID, plaintextToken, newPassword string) error {
	if len(newPassword) < 8 {
		return apierror.New(422, "validation_error", "Le mot de passe doit contenir au moins 8 caractères.")
	}

	hash := sha256.Sum256([]byte(plaintextToken))
	tokenHash := hex.EncodeToString(hash[:])

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return apierror.ErrInternal
	}

	return s.pool.WithTenant(ctx, tenantID, func(ctx context.Context, tx db.TxLike) error {
		var customerID uuid.UUID
		row := tx.QueryRow(ctx, `
			SELECT customer_id FROM customer_password_resets
			WHERE token_hash = $1 AND tenant_id = $2 AND used_at IS NULL AND expires_at > now()
		`, tokenHash, tenantID)
		if err := row.Scan(&customerID); err != nil {
			return apierror.New(400, "invalid_or_expired_token", "Ce lien de réinitialisation est invalide ou expiré.")
		}

		if _, err := tx.Exec(ctx, `UPDATE customers SET password_hash = $1 WHERE id = $2`, string(newHash), customerID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE customer_password_resets SET used_at = now() WHERE token_hash = $1`, tokenHash)
		return err
	})
}
