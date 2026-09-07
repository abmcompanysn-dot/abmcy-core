package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ResendClient sends transactional email via https://resend.com/'s API.
type ResendClient struct {
	apiKey     string
	fromAddr   string
	httpClient *http.Client
}

// ErrNotConfigured is returned whenever the Resend API key hasn't been
// set yet from the super-admin dashboard (Configuration page).
var ErrNotConfigured = fmt.Errorf("resend: not configured")

func NewResendClient(apiKey, fromAddr string) (*ResendClient, error) {
	if apiKey == "" || fromAddr == "" {
		return nil, ErrNotConfigured
	}
	return &ResendClient{
		apiKey:     apiKey,
		fromAddr:   fromAddr,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}, nil
}

type sendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

type sendResponse struct {
	ID string `json:"id"`
}

func (c *ResendClient) Send(ctx context.Context, to, subject, html string) (string, error) {
	payload := sendRequest{From: c.fromAddr, To: []string{to}, Subject: subject, HTML: html}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("resend: encode: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("resend: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("resend: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("resend: status %d", resp.StatusCode)
	}

	var parsed sendResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", fmt.Errorf("resend: decode response: %w", err)
	}
	return parsed.ID, nil
}
