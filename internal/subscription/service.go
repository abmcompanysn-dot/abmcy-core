// Package subscription bills tenants for their own ABMCY Core
// subscription (distinct from internal/payment, which handles a tenant's
// customers paying THAT tenant for orders). Uses ABMCY's own ABMCY Core
// Payment merchant account (internal/platformconfig
// KeyABMCYPaymentAppKey/HMACSecret) — never a tenant's own credentials,
// since here ABMCY is the one getting paid.
package subscription

import (
	"context"
	"fmt"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/internal/tenantpayment"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

// gracePeriod is how long a tenant can stay past_due before Enforce
// suspends it (is_active = false) — enough time for a retry or manual
// follow-up before storefronts actually go down.
const gracePeriod = 7 * 24 * time.Hour

type Service struct {
	pool    *db.Pool
	cfg     *platformconfig.Service
	baseURL string
}

func NewService(pool *db.Pool, cfg *platformconfig.Service, baseURL string) *Service {
	return &Service{pool: pool, cfg: cfg, baseURL: baseURL}
}

// client builds a Client from ABMCY's own merchant credentials — returns
// a clear 503 if an operator hasn't configured them yet on GET/PUT
// /admin/config, same shape as every other platformconfig-backed feature.
func (s *Service) client() (*tenantpayment.Client, error) {
	appKey, ok1 := s.cfg.Get(platformconfig.KeyABMCYPaymentAppKey)
	hmacSecret, ok2 := s.cfg.Get(platformconfig.KeyABMCYPaymentHMACSecret)
	if !ok1 || !ok2 {
		return nil, apierror.New(503, "billing_not_configured",
			"La facturation d'abonnement n'est pas configurée. Renseignez les clés ABMCY Core Payment de la plateforme.")
	}
	return tenantpayment.NewClient(s.baseURL, appKey, hmacSecret), nil
}

// hmacSecret exposes ABMCY's own hmac_secret for webhook verification —
// separate accessor (rather than reusing client()) since the webhook
// handler only needs the secret, not a full client.
func (s *Service) hmacSecret() (string, error) {
	secret, ok := s.cfg.Get(platformconfig.KeyABMCYPaymentHMACSecret)
	if !ok {
		return "", apierror.New(503, "billing_not_configured", "La facturation d'abonnement n'est pas configurée.")
	}
	return secret, nil
}

func (s *Service) VerifyWebhookSignature(rawBody []byte, signatureHex string) bool {
	secret, err := s.hmacSecret()
	if err != nil {
		return false
	}
	return tenantpayment.VerifyWebhookSignature(secret, rawBody, signatureHex)
}

// SetPrice fixes (or changes) a tenant's monthly subscription price —
// admin-only, negotiated per client rather than picked from a fixed
// plan. Setting a price for the first time also activates the
// subscription and schedules its first due date one month out.
func (s *Service) SetPrice(ctx context.Context, tenantID uuid.UUID, priceFCFA int) error {
	if priceFCFA < 0 {
		return apierror.ErrValidation
	}
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		var hadPrice bool
		if err := tx.QueryRow(ctx, `SELECT subscription_price_fcfa IS NOT NULL FROM tenants WHERE id = $1`, tenantID).Scan(&hadPrice); err != nil {
			return err
		}
		if hadPrice {
			_, err := tx.Exec(ctx, `UPDATE tenants SET subscription_price_fcfa = $1 WHERE id = $2`, priceFCFA, tenantID)
			return err
		}
		_, err := tx.Exec(ctx, `
			UPDATE tenants SET
				subscription_price_fcfa = $1,
				subscription_status = 'active',
				next_billing_at = now() + interval '1 month',
				past_due_since = NULL
			WHERE id = $2
		`, priceFCFA, tenantID)
		return err
	})
}

// Subscription is the billing state exposed to the admin and tenant
// dashboards.
type Subscription struct {
	PriceFCFA     *int       `json:"price_fcfa"`
	Status        string     `json:"status"` // inactive | active | past_due | cancelled
	NextBillingAt *time.Time `json:"next_billing_at"`
	PastDueSince  *time.Time `json:"past_due_since"`
	CGUAcceptedAt *time.Time `json:"cgu_accepted_at"`
}

func (s *Service) Get(ctx context.Context, tenantID uuid.UUID) (*Subscription, error) {
	var sub Subscription
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		return tx.QueryRow(ctx, `
			SELECT subscription_price_fcfa, subscription_status, next_billing_at, past_due_since, cgu_accepted_at
			FROM tenants WHERE id = $1
		`, tenantID).Scan(&sub.PriceFCFA, &sub.Status, &sub.NextBillingAt, &sub.PastDueSince, &sub.CGUAcceptedAt)
	})
	if err != nil {
		return nil, apierror.ErrNotFound
	}
	return &sub, nil
}

// AcceptCGU records a tenant owner's acceptance of ABMCY Core's terms of
// use — a timestamp, not a checkbox state, so it can't be silently
// un-accepted and always answers "when" if ever disputed.
func (s *Service) AcceptCGU(ctx context.Context, tenantID uuid.UUID) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `UPDATE tenants SET cgu_accepted_at = now() WHERE id = $1`, tenantID)
		return err
	})
}

// Payment is one billing period's row, as shown in the tenant's or
// admin's payment history.
type Payment struct {
	ID          uuid.UUID  `json:"id"`
	AmountFCFA  int        `json:"amount_fcfa"`
	Status      string     `json:"status"` // pending | paid | failed
	PeriodStart time.Time  `json:"period_start"`
	PeriodEnd   time.Time  `json:"period_end"`
	PaymentURL  string     `json:"payment_url,omitempty"`
	PaidAt      *time.Time `json:"paid_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// CreateInvoice generates the next billing period's payment link via
// ABMCY Core Payment, for a tenant that already has a price set. Called
// either by the tenant themselves (to pay ahead / catch up) or by a
// scheduled job on next_billing_at.
func (s *Service) CreateInvoice(ctx context.Context, tenantID uuid.UUID, callbackURL, returnURL string) (*Payment, error) {
	sub, err := s.Get(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if sub.PriceFCFA == nil {
		return nil, apierror.New(422, "no_price_set", "Aucun prix d'abonnement n'a été fixé pour ce tenant.")
	}

	client, err := s.client()
	if err != nil {
		return nil, err
	}

	appRef := "sub-" + uuid.NewString()
	periodStart := time.Now()
	periodEnd := periodStart.AddDate(0, 1, 0)

	result, err := client.CreatePayment(ctx, tenantpayment.CreatePaymentInput{
		AppRef:      appRef,
		AmountCFA:   *sub.PriceFCFA,
		Country:     "SEN",
		Description: "Abonnement ABMCY Core",
		CallbackURL: callbackURL,
		ReturnURL:   returnURL,
	})
	if err != nil {
		return nil, fmt.Errorf("subscription: create invoice: %w", err)
	}

	var p Payment
	err = s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO subscription_payments (tenant_id, amount_fcfa, status, period_start, period_end, payment_url, external_ref)
			VALUES ($1, $2, 'pending', $3, $4, $5, $6)
			RETURNING id, amount_fcfa, status, period_start, period_end, coalesce(payment_url, ''), paid_at, created_at
		`, tenantID, *sub.PriceFCFA, periodStart, periodEnd, result.HostedPayURL, appRef)
		return row.Scan(&p.ID, &p.AmountFCFA, &p.Status, &p.PeriodStart, &p.PeriodEnd, &p.PaymentURL, &p.PaidAt, &p.CreatedAt)
	})
	if err != nil {
		return nil, fmt.Errorf("subscription: record invoice: %w", err)
	}
	return &p, nil
}

// ListPayments returns a tenant's subscription billing history, most
// recent first.
func (s *Service) ListPayments(ctx context.Context, tenantID uuid.UUID) ([]Payment, error) {
	var payments []Payment
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, amount_fcfa, status, period_start, period_end, coalesce(payment_url, ''), paid_at, created_at
			FROM subscription_payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100
		`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var p Payment
			if err := rows.Scan(&p.ID, &p.AmountFCFA, &p.Status, &p.PeriodStart, &p.PeriodEnd, &p.PaymentURL, &p.PaidAt, &p.CreatedAt); err != nil {
				return err
			}
			payments = append(payments, p)
		}
		return rows.Err()
	})
	return payments, err
}

// HandleWebhook applies an ABMCY Core Payment callback for a subscription
// invoice (app_ref prefixed "sub-") — the caller has already verified the
// signature via VerifyWebhookSignature. Re-queries the real status as a
// safety net, same as internal/payment.Service.HandleWebhook.
func (s *Service) HandleWebhook(ctx context.Context, appRef string) error {
	client, err := s.client()
	if err != nil {
		return err
	}
	p, err := client.GetPayment(ctx, appRef)
	if err != nil {
		return fmt.Errorf("subscription: webhook verify: %w", err)
	}

	switch p.Status {
	case "completed":
		return s.markPaid(ctx, appRef)
	case "failed", "cancelled":
		return s.markFailed(ctx, appRef)
	default:
		return nil // pending/processing — nothing to apply yet
	}
}

func (s *Service) markPaid(ctx context.Context, appRef string) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		var tenantID uuid.UUID
		var periodEnd time.Time
		if err := tx.QueryRow(ctx, `
			UPDATE subscription_payments SET status = 'paid', paid_at = now()
			WHERE external_ref = $1 AND status <> 'paid'
			RETURNING tenant_id, period_end
		`, appRef).Scan(&tenantID, &periodEnd); err != nil {
			return err // already paid (replayed webhook) or unknown ref — nothing more to do
		}
		_, err := tx.Exec(ctx, `
			UPDATE tenants SET
				subscription_status = 'active',
				next_billing_at = $1,
				past_due_since = NULL,
				is_active = TRUE
			WHERE id = $2
		`, periodEnd, tenantID)
		return err
	})
}

func (s *Service) markFailed(ctx context.Context, appRef string) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		var tenantID uuid.UUID
		if err := tx.QueryRow(ctx, `
			UPDATE subscription_payments SET status = 'failed'
			WHERE external_ref = $1
			RETURNING tenant_id
		`, appRef).Scan(&tenantID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			UPDATE tenants SET
				subscription_status = 'past_due',
				past_due_since = COALESCE(past_due_since, now())
			WHERE id = $1
		`, tenantID)
		return err
	})
}

// Enforce suspends every tenant whose subscription has been past_due for
// longer than gracePeriod — meant to run on a schedule (e.g. daily). A
// suspended tenant's storefront and dashboard behave exactly like any
// other suspended tenant (see internal/middleware.TenantAuth /
// httpserver.staffAuth): tenant_suspended, blocked page.
func (s *Service) Enforce(ctx context.Context) (suspended int, err error) {
	err = s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		tag, execErr := tx.Exec(ctx, `
			UPDATE tenants SET is_active = FALSE, subscription_status = 'cancelled'
			WHERE subscription_status = 'past_due'
			  AND past_due_since IS NOT NULL
			  AND past_due_since < now() - make_interval(secs => $1)
			  AND is_active = TRUE
		`, gracePeriod.Seconds())
		if execErr != nil {
			return execErr
		}
		suspended = int(tag.RowsAffected())
		return nil
	})
	return suspended, err
}
