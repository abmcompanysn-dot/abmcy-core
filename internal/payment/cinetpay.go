package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// CinetPayClient integrates CinetPay, which aggregates Wave, Orange Money
// (OM), MTN MoMo, and card payments behind a single West-African-friendly
// API — one integration instead of three separate mobile money SDKs.
type CinetPayClient struct {
	apiKey     string
	siteID     string
	httpClient *http.Client
}

func NewCinetPayClient(apiKey, siteID string) *CinetPayClient {
	return &CinetPayClient{
		apiKey:     apiKey,
		siteID:     siteID,
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

type InitPaymentInput struct {
	TransactionID string // maps to our payments.provider_ref
	Amount        int    // FCFA
	Currency      string // "XOF"
	Description   string
	CustomerName  string
	CustomerPhone string
	ReturnURL     string
	NotifyURL     string // webhook: POST /webhooks/cinetpay
}

type InitPaymentResult struct {
	PaymentURL string `json:"payment_url"`
}

type initRequest struct {
	APIKey        string `json:"apikey"`
	SiteID        string `json:"site_id"`
	TransactionID string `json:"transaction_id"`
	Amount        int    `json:"amount"`
	Currency      string `json:"currency"`
	Description   string `json:"description"`
	CustomerName  string `json:"customer_name"`
	CustomerPhone string `json:"customer_phone_number"`
	ReturnURL     string `json:"return_url"`
	NotifyURL     string `json:"notify_url"`
	Channels      string `json:"channels"` // ALL = card + mobile money
}

type initResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Data    struct {
		PaymentURL string `json:"payment_url"`
	} `json:"data"`
}

func (c *CinetPayClient) InitPayment(ctx context.Context, in InitPaymentInput) (*InitPaymentResult, error) {
	payload := initRequest{
		APIKey:        c.apiKey,
		SiteID:        c.siteID,
		TransactionID: in.TransactionID,
		Amount:        in.Amount,
		Currency:      in.Currency,
		Description:   in.Description,
		CustomerName:  in.CustomerName,
		CustomerPhone: in.CustomerPhone,
		ReturnURL:     in.ReturnURL,
		NotifyURL:     in.NotifyURL,
		Channels:      "ALL",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("cinetpay: encode: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api-checkout.cinetpay.com/v2/payment", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("cinetpay: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cinetpay: request failed: %w", err)
	}
	defer resp.Body.Close()

	var parsed initResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("cinetpay: decode response: %w", err)
	}
	if parsed.Code != "201" {
		return nil, fmt.Errorf("cinetpay: init failed: %s", parsed.Message)
	}

	return &InitPaymentResult{PaymentURL: parsed.Data.PaymentURL}, nil
}

// VerifyTransaction re-queries CinetPay for a transaction's real status
// instead of trusting the webhook payload alone (CinetPay's own
// recommended anti-fraud practice).
func (c *CinetPayClient) VerifyTransaction(ctx context.Context, transactionID string) (status string, err error) {
	payload := map[string]string{"apikey": c.apiKey, "site_id": c.siteID, "transaction_id": transactionID}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api-checkout.cinetpay.com/v2/payment/check", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("cinetpay: build verify request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("cinetpay: verify request failed: %w", err)
	}
	defer resp.Body.Close()

	var parsed struct {
		Data struct {
			Status string `json:"status"` // ACCEPTED | REFUSED | ...
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", fmt.Errorf("cinetpay: decode verify response: %w", err)
	}
	return parsed.Data.Status, nil
}
