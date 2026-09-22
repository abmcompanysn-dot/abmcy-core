// Package domain lets a tenant either register that they already own a
// domain, or search and purchase a new one through ABMCY — which buys it
// on its own Porkbun account and bills the tenant (via ABMCY Core
// Payment) at Porkbun's price plus a margin (see Service.markup).
//
// Porkbun over Namecheap: Namecheap's reseller API requires a $50+
// account balance (or 20+ domains, or $50+ purchased in the last 2
// years) before API access is even granted — a real blocker for a fresh
// account. Porkbun's API has no such minimum and is free to enable.
package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const porkbunBaseURL = "https://api.porkbun.com/api/json/v3"

// Client calls the Porkbun domain API. Every request is a signed POST
// with apikey/secretapikey in the JSON body (Porkbun has no separate
// IP-whitelisting step, unlike Namecheap).
type Client struct {
	apiKey       string
	secretAPIKey string
	httpClient   *http.Client
}

func NewClient(apiKey, secretAPIKey string) *Client {
	return &Client{
		apiKey:       apiKey,
		secretAPIKey: secretAPIKey,
		httpClient:   &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Client) post(ctx context.Context, path string, payload map[string]any, out any) error {
	if payload == nil {
		payload = map[string]any{}
	}
	payload["apikey"] = c.apiKey
	payload["secretapikey"] = c.secretAPIKey

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("domain: encode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, porkbunBaseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("domain: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("domain: request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("domain: read response: %w", err)
	}
	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("domain: decode response: %w", err)
	}
	return nil
}

// --- POST /domain/checkDomain/{domain} -------------------------------------

type checkResponse struct {
	Status   string `json:"status"` // "SUCCESS" | "ERROR"
	Message  string `json:"message,omitempty"`
	Response struct {
		Avail          string `json:"avail"` // "yes"/"no" (confirmed live traffic) — Porkbun encodes these as strings
		Price          string `json:"price"`
		FirstYearPromo string `json:"firstYearPromo"`
	} `json:"response"`
}

// CheckResult is one domain's availability and 1-year registration price
// (USD, Porkbun's raw price — the caller applies ABMCY's markup on top).
type CheckResult struct {
	Domain    string
	Available bool
	PriceUSD  float64
}

// Check reports availability and price for a single fully-qualified
// domain (e.g. "boutique-fatou.com") — unlike Namecheap's batched
// domains.check, Porkbun's checkDomain takes one domain per call.
func (c *Client) Check(ctx context.Context, fqdn string) (*CheckResult, error) {
	var out checkResponse
	if err := c.post(ctx, "/domain/checkDomain/"+fqdn, nil, &out); err != nil {
		return nil, err
	}
	if out.Status != "SUCCESS" {
		return nil, fmt.Errorf("domain: porkbun check %s: %s", fqdn, out.Message)
	}

	result := &CheckResult{Domain: fqdn, Available: out.Response.Avail == "yes"}
	if result.Available {
		priceStr := out.Response.Price
		if out.Response.FirstYearPromo != "" {
			priceStr = out.Response.FirstYearPromo
		}
		var usd float64
		if _, err := fmt.Sscanf(priceStr, "%f", &usd); err == nil {
			result.PriceUSD = usd
		}
	}
	return result, nil
}

// --- POST /pricing/get -------------------------------------------------
// Public endpoint — no apikey/secretapikey required (still sent by post()
// as harmless extra fields; Porkbun ignores them here), lists every TLD
// Porkbun actually sells along with its price. Used to confirm a TLD is
// real and priced before Search bothers calling checkDomain on it — that
// call costs about a second each, so it's only worth spending on TLDs
// this endpoint has already confirmed exist.

type pricingResponse struct {
	Status  string `json:"status"`
	Pricing map[string]struct {
		Registration string `json:"registration"`
	} `json:"pricing"`
}

// Pricing returns every TLD Porkbun currently sells, mapped to its 1-year
// registration price in USD.
func (c *Client) Pricing(ctx context.Context) (map[string]float64, error) {
	var out pricingResponse
	if err := c.post(ctx, "/pricing/get", nil, &out); err != nil {
		return nil, err
	}
	if out.Status != "SUCCESS" {
		return nil, fmt.Errorf("domain: porkbun pricing: unexpected status %q", out.Status)
	}

	prices := make(map[string]float64, len(out.Pricing))
	for tld, p := range out.Pricing {
		var usd float64
		if _, err := fmt.Sscanf(p.Registration, "%f", &usd); err == nil {
			prices[tld] = usd
		}
	}
	return prices, nil
}

// --- POST /domain/create/{domain} ------------------------------------------
// Unlike Namecheap, Porkbun doesn't take WHOIS contact fields per request
// — registration uses the account's own verified email/phone on file
// (Porkbun requires those to be verified before any domain.create call
// succeeds). costCents is what Service already computed from the price
// Check just returned, passed back in explicitly rather than re-fetched,
// so the two calls can't disagree about the price between check and
// purchase.

type createResponse struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	Cost    int    `json:"cost"`
	OrderID int64  `json:"orderId"`
}

// Register purchases the domain on ABMCY's Porkbun account — irreversible
// and billed to ABMCY's account balance. costCents is the exact price
// (USD cents) confirmed by a prior Check call for this same domain.
func (c *Client) Register(ctx context.Context, fqdn string, costCents int) error {
	var out createResponse
	err := c.post(ctx, "/domain/create/"+fqdn, map[string]any{
		"cost":         costCents,
		"agreeToTerms": "yes",
		"whoisPrivacy": true,
	}, &out)
	if err != nil {
		return err
	}
	if out.Status != "SUCCESS" {
		return fmt.Errorf("domain: porkbun create %s: %s", fqdn, out.Message)
	}
	return nil
}
