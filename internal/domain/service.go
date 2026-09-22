package domain

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abmcy/core/internal/db"
	"github.com/abmcy/core/internal/platformconfig"
	"github.com/abmcy/core/internal/tenantpayment"
	"github.com/abmcy/core/pkg/apierror"
	"github.com/google/uuid"
)

// markup is ABMCY's margin on a domain's Porkbun cost — the tenant is
// charged registrarCost * (1 + markup), never Porkbun's raw price.
const markup = 0.20

// usdToFCFA is a fixed approximation (West African CFA franc is pegged to
// the euro, not floating against the dollar day-to-day) — precise enough
// for a domain markup, not meant for high-value currency conversion.
const usdToFCFA = 600

type Service struct {
	pool *db.Pool
	cfg  *platformconfig.Service
}

func NewService(pool *db.Pool, cfg *platformconfig.Service) *Service {
	return &Service{pool: pool, cfg: cfg}
}

func (s *Service) client() (*Client, error) {
	apiKey, ok1 := s.cfg.Get(platformconfig.KeyPorkbunAPIKey)
	secretAPIKey, ok2 := s.cfg.Get(platformconfig.KeyPorkbunSecretAPIKey)
	if !ok1 || !ok2 {
		return nil, apierror.New(503, "domain_search_not_configured",
			"La recherche de domaine n'est pas configurée. Renseignez les clés Porkbun de la plateforme.")
	}
	return NewClient(apiKey, secretAPIKey), nil
}

// SearchResult is what a tenant sees when searching for a domain — never
// Porkbun's raw cost, only ABMCY's marked-up price.
type SearchResult struct {
	Domain    string `json:"domain"`
	Available bool   `json:"available"`
	PriceFCFA int    `json:"price_fcfa,omitempty"` // absent if unavailable
}

// Search checks a base name across a handful of common TLDs and returns
// ABMCY's price for each available one. base is the name without any
// TLD (e.g. "boutique-fatou") — the caller (tenant dashboard) supplies
// it from a single search box.
func (s *Service) Search(ctx context.Context, base string) ([]SearchResult, error) {
	if base == "" {
		return nil, apierror.ErrValidation
	}
	client, err := s.client()
	if err != nil {
		return nil, err
	}

	tlds := []string{"com", "net", "org", "shop", "store", "africa", "online"}
	results := make([]SearchResult, 0, len(tlds))
	for _, tld := range tlds {
		fqdn := base + "." + tld
		r, err := client.Check(ctx, fqdn)
		if err != nil {
			// One TLD failing (e.g. Porkbun doesn't support it) shouldn't
			// abort the whole search — skip it and keep going.
			slog.Warn("domain: check failed for tld", "domain", fqdn, "error", err)
			continue
		}
		sr := SearchResult{Domain: r.Domain, Available: r.Available}
		if r.Available && r.PriceUSD > 0 {
			sr.PriceFCFA = fcfaWithMarkup(r.PriceUSD)
		}
		results = append(results, sr)
	}
	return results, nil
}

func fcfaWithMarkup(usd float64) int {
	return int(usd * usdToFCFA * (1 + markup))
}

// TenantDomain is one entry in a tenant's domain history (existing or
// purchased), as shown to the tenant and the admin.
type TenantDomain struct {
	ID         uuid.UUID `json:"id"`
	Domain     string    `json:"domain"`
	Source     string    `json:"source"` // existing | purchased
	Status     string    `json:"status"` // pending | active | failed
	PriceFCFA  *int      `json:"price_fcfa,omitempty"`
	PaymentURL string    `json:"payment_url,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// RegisterExisting records that a tenant already owns a domain — no
// payment, no purchase, active immediately. Doesn't verify ownership
// (DNS/WHOIS check) — the tenant is trusted to point it at their own
// storefront themselves; see tenant.UpdateProfileInput.StorefrontURL for
// where it actually gets used once pointed.
func (s *Service) RegisterExisting(ctx context.Context, tenantID uuid.UUID, domain string) (*TenantDomain, error) {
	if domain == "" {
		return nil, apierror.ErrValidation
	}
	var d TenantDomain
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO tenant_domains (tenant_id, domain, source, status)
			VALUES ($1, $2, 'existing', 'active')
			RETURNING id, domain, source, status, created_at
		`, tenantID, domain)
		return row.Scan(&d.ID, &d.Domain, &d.Source, &d.Status, &d.CreatedAt)
	})
	if err != nil {
		return nil, fmt.Errorf("domain: register existing: %w", err)
	}
	return &d, nil
}

// InitiatePurchase creates an ABMCY Core Payment invoice for a domain the
// tenant wants ABMCY to buy on their behalf — the actual Porkbun purchase
// only happens once that payment is confirmed (see HandleWebhook), never
// before, since it's an irreversible charge on ABMCY's own account.
func (s *Service) InitiatePurchase(ctx context.Context, tenantID uuid.UUID, domainName string, callbackURL, returnURL string) (*TenantDomain, error) {
	if domainName == "" {
		return nil, apierror.ErrValidation
	}
	client, err := s.client()
	if err != nil {
		return nil, err
	}

	check, err := client.Check(ctx, domainName)
	if err != nil {
		return nil, fmt.Errorf("domain: check before purchase: %w", err)
	}
	if !check.Available {
		return nil, apierror.New(422, "domain_unavailable", "Ce domaine n'est plus disponible.")
	}
	if check.PriceUSD <= 0 {
		return nil, apierror.New(422, "validation_error", "Extension de domaine non prise en charge.")
	}
	priceFCFA := fcfaWithMarkup(check.PriceUSD)
	registrarCostFCFA := int(check.PriceUSD * usdToFCFA)

	// ABMCY's own payment account, same one used for subscription billing
	// — a domain purchase is ABMCY charging the tenant, not the tenant's
	// own commerce.
	appKey, ok1 := s.cfg.Get(platformconfig.KeyABMCYPaymentAppKey)
	hmacSecret, ok2 := s.cfg.Get(platformconfig.KeyABMCYPaymentHMACSecret)
	if !ok1 || !ok2 {
		return nil, apierror.New(503, "billing_not_configured", "La facturation n'est pas configurée.")
	}
	paymentClient := tenantpayment.NewClient("https://core.diarra.app", appKey, hmacSecret)

	appRef := "domain-" + uuid.NewString()
	result, err := paymentClient.CreatePayment(ctx, tenantpayment.CreatePaymentInput{
		AppRef:      appRef,
		AmountCFA:   priceFCFA,
		Country:     "SEN",
		Description: "Achat du domaine " + domainName,
		CallbackURL: callbackURL,
		ReturnURL:   returnURL,
	})
	if err != nil {
		slog.Error("domain: ABMCY Core Payment rejected purchase request", "error", err)
		return nil, apierror.New(502, "billing_provider_error", "ABMCY Core Payment a refusé la demande de paiement.")
	}

	var d TenantDomain
	err = s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		row := tx.QueryRow(ctx, `
			INSERT INTO tenant_domains (tenant_id, domain, source, status, price_fcfa, registrar_cost_fcfa, payment_url, external_ref)
			VALUES ($1, $2, 'purchased', 'pending', $3, $4, $5, $6)
			RETURNING id, domain, source, status, price_fcfa, coalesce(payment_url, ''), created_at
		`, tenantID, domainName, priceFCFA, registrarCostFCFA, result.HostedPayURL, appRef)
		return row.Scan(&d.ID, &d.Domain, &d.Source, &d.Status, &d.PriceFCFA, &d.PaymentURL, &d.CreatedAt)
	})
	if err != nil {
		return nil, fmt.Errorf("domain: record purchase: %w", err)
	}
	return &d, nil
}

// HandleWebhook applies an ABMCY Core Payment callback for a domain
// purchase (app_ref prefixed "domain-"). On confirmed payment, actually
// registers the domain via Porkbun — this is the ONLY place the real,
// billable purchase happens, deliberately gated behind payment
// confirmation rather than at InitiatePurchase time.
func (s *Service) HandleWebhook(ctx context.Context, appRef string) error {
	appKey, ok1 := s.cfg.Get(platformconfig.KeyABMCYPaymentAppKey)
	hmacSecret, ok2 := s.cfg.Get(platformconfig.KeyABMCYPaymentHMACSecret)
	if !ok1 || !ok2 {
		return apierror.New(503, "billing_not_configured", "La facturation n'est pas configurée.")
	}
	paymentClient := tenantpayment.NewClient("https://core.diarra.app", appKey, hmacSecret)
	p, err := paymentClient.GetPayment(ctx, appRef)
	if err != nil {
		return fmt.Errorf("domain: webhook verify: %w", err)
	}

	switch p.Status {
	case "completed":
		return s.completePurchase(ctx, appRef)
	case "failed", "cancelled":
		return s.markFailed(ctx, appRef)
	default:
		return nil
	}
}

func (s *Service) completePurchase(ctx context.Context, appRef string) error {
	var id uuid.UUID
	var domainName string
	var registrarCostFCFA int
	var alreadyDone bool
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		scanErr := tx.QueryRow(ctx, `
			SELECT id, domain, coalesce(registrar_cost_fcfa, 0), status = 'active'
			FROM tenant_domains WHERE external_ref = $1
		`, appRef).Scan(&id, &domainName, &registrarCostFCFA, &alreadyDone)
		return scanErr
	})
	if err != nil {
		return fmt.Errorf("domain: lookup pending purchase: %w", err)
	}
	if alreadyDone {
		return nil // replayed webhook — already registered, nothing more to do
	}

	client, err := s.client()
	if err != nil {
		return err
	}
	// registrar_cost_fcfa was stored as FCFA at InitiatePurchase time —
	// convert back to USD cents for Porkbun's own cost field, since that's
	// the currency/unit its create endpoint bills in.
	costCents := int((float64(registrarCostFCFA) / usdToFCFA) * 100)
	if err := client.Register(ctx, domainName, costCents); err != nil {
		slog.Error("domain: porkbun registration failed after payment", "domain", domainName, "error", err)
		return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
			_, execErr := tx.Exec(ctx, `UPDATE tenant_domains SET status = 'failed', updated_at = now() WHERE id = $1`, id)
			return execErr
		})
	}

	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, execErr := tx.Exec(ctx, `UPDATE tenant_domains SET status = 'active', updated_at = now() WHERE id = $1`, id)
		return execErr
	})
}

func (s *Service) markFailed(ctx context.Context, appRef string) error {
	return s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		_, err := tx.Exec(ctx, `UPDATE tenant_domains SET status = 'failed', updated_at = now() WHERE external_ref = $1`, appRef)
		return err
	})
}

// ListForTenant returns a tenant's own domain history.
func (s *Service) ListForTenant(ctx context.Context, tenantID uuid.UUID) ([]TenantDomain, error) {
	return s.list(ctx, `WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
}

func (s *Service) list(ctx context.Context, whereClause string, args ...any) ([]TenantDomain, error) {
	domains := []TenantDomain{}
	err := s.pool.WithSystem(ctx, func(ctx context.Context, tx db.TxLike) error {
		rows, err := tx.Query(ctx, `
			SELECT id, domain, source, status, price_fcfa, coalesce(payment_url, ''), created_at
			FROM tenant_domains `+whereClause, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var d TenantDomain
			if err := rows.Scan(&d.ID, &d.Domain, &d.Source, &d.Status, &d.PriceFCFA, &d.PaymentURL, &d.CreatedAt); err != nil {
				return err
			}
			domains = append(domains, d)
		}
		return rows.Err()
	})
	return domains, err
}
