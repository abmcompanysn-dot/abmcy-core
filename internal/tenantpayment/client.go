package tenantpayment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// Client calls the ABMCY Core Payment API (orchestrator). Every /v1/*
// request carries three headers:
//   X-App-Key           the tenant's api_key
//   X-Abmcy-Timestamp   Unix seconds, valid ±5 min
//   X-Abmcy-Signature   HMAC_SHA256( SHA256(hmac_secret), "{ts}.{body}" ) hex
//
// The HMAC key is the SHA-256 hash of the secret, NOT the raw secret.
type Client struct {
	baseURL    string
	appKey     string
	hmacKey    []byte // SHA-256(hmac_secret), precomputed
	httpClient *http.Client
}

func NewClient(baseURL, appKey, hmacSecret string) *Client {
	sum := sha256.Sum256([]byte(hmacSecret))
	return &Client{
		baseURL:    baseURL,
		appKey:     appKey,
		hmacKey:    sum[:],
		httpClient: &http.Client{Timeout: 25 * time.Second},
	}
}

// sign returns the hex HMAC of "{ts}.{body}" under SHA-256(hmac_secret).
func (c *Client) sign(ts, body string) string {
	mac := hmac.New(sha256.New, c.hmacKey)
	mac.Write([]byte(ts + "." + body))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyWebhookSignature checks a callback: HMAC_SHA256(SHA256(secret),
// raw_body) must equal the X-Abmcy-Signature header (hex).
func VerifyWebhookSignature(hmacSecret string, rawBody []byte, signatureHex string) bool {
	sum := sha256.Sum256([]byte(hmacSecret))
	mac := hmac.New(sha256.New, sum[:])
	mac.Write(rawBody)
	expected := mac.Sum(nil)
	got, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false
	}
	return hmac.Equal(expected, got)
}

func (c *Client) post(ctx context.Context, path string, payload any) ([]byte, int, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, fmt.Errorf("tenantpayment: encode: %w", err)
	}
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := c.sign(ts, string(body))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, 0, fmt.Errorf("tenantpayment: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-App-Key", c.appKey)
	req.Header.Set("X-Abmcy-Timestamp", ts)
	req.Header.Set("X-Abmcy-Signature", sig)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("tenantpayment: request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	return respBody, resp.StatusCode, nil
}

// --- POST /v1/pay ---------------------------------------------------------

type CreatePaymentInput struct {
	AppRef      string `json:"app_ref"` // our order ID
	AmountCFA   int    `json:"amount_cfa"`
	Country     string `json:"country"`
	Description  string `json:"description,omitempty"`
	CallbackURL string `json:"callback_url,omitempty"`
	ReturnURL   string `json:"return_url,omitempty"`
}

type Payment struct {
	AppRef        string `json:"app_ref"`
	Status        string `json:"status"` // pending|processing|completed|failed|cancelled
	AmountCFA     int    `json:"amount_cfa"`
	FeeCFA        int    `json:"fee_cfa"`
	NetCFA        int    `json:"net_cfa"`
	RedirectURL   string `json:"redirect_url"`
	ReturnURL     string `json:"return_url"`
	FailureReason string `json:"failure_reason"`
	Type          string `json:"type"` // "" for deposits, "refund" for refunds
}

type CreatePaymentResult struct {
	Payment      Payment `json:"payment"`
	HostedPayURL string  `json:"hosted_pay_url"`
}

func (c *Client) CreatePayment(ctx context.Context, in CreatePaymentInput) (*CreatePaymentResult, error) {
	body, status, err := c.post(ctx, "/v1/pay", in)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("tenantpayment: /v1/pay returned %d: %s", status, string(body))
	}
	var out CreatePaymentResult
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("tenantpayment: decode /v1/pay: %w", err)
	}
	return &out, nil
}

// --- GET /v1/payments/{app_ref} (signed, empty body) --------------------

func (c *Client) GetPayment(ctx context.Context, appRef string) (*Payment, error) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := c.sign(ts, "")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v1/payments/"+appRef, nil)
	if err != nil {
		return nil, fmt.Errorf("tenantpayment: build request: %w", err)
	}
	req.Header.Set("X-App-Key", c.appKey)
	req.Header.Set("X-Abmcy-Timestamp", ts)
	req.Header.Set("X-Abmcy-Signature", sig)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tenantpayment: request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("tenantpayment: GET /v1/payments returned %d: %s", resp.StatusCode, string(body))
	}
	// The endpoint returns { "payment": {...} } (same envelope as /v1/pay).
	var wrapped struct {
		Payment Payment `json:"payment"`
	}
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, fmt.Errorf("tenantpayment: decode GET /v1/payments: %w", err)
	}
	return &wrapped.Payment, nil
}
