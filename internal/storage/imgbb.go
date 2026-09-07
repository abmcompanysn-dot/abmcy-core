package storage

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"time"
)

// ImgBBClient uploads image bytes to https://api.imgbb.com/ and returns
// the hosted URL. ABMCY does not store image bytes itself — only the
// resulting URL — so the VPS disk stays untouched by client uploads.
type ImgBBClient struct {
	apiKey     string
	httpClient *http.Client
}

func NewImgBBClient(apiKey string) *ImgBBClient {
	return &ImgBBClient{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

type imgbbResponse struct {
	Data struct {
		URL       string `json:"url"`
		DeleteURL string `json:"delete_url"`
		Size      int64  `json:"size"`
	} `json:"data"`
	Success bool `json:"success"`
	Status  int  `json:"status"`
}

type UploadResult struct {
	URL       string
	DeleteURL string
	SizeBytes int64
}

// Upload sends raw image bytes to imgbb and returns the public URL.
// imgbb expects the image as base64 in a multipart form field "image".
func (c *ImgBBClient) Upload(ctx context.Context, filename string, data []byte) (*UploadResult, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	if err := writer.WriteField("image", base64.StdEncoding.EncodeToString(data)); err != nil {
		return nil, fmt.Errorf("imgbb: write field: %w", err)
	}
	if err := writer.WriteField("name", filename); err != nil {
		return nil, fmt.Errorf("imgbb: write field: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("imgbb: close writer: %w", err)
	}

	endpoint := "https://api.imgbb.com/1/upload?" + url.Values{"key": {c.apiKey}}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return nil, fmt.Errorf("imgbb: build request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("imgbb: request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("imgbb: read response: %w", err)
	}

	var parsed imgbbResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("imgbb: decode response: %w", err)
	}
	if !parsed.Success {
		return nil, fmt.Errorf("imgbb: upload failed, status=%d body=%s", parsed.Status, string(raw))
	}

	return &UploadResult{
		URL:       parsed.Data.URL,
		DeleteURL: parsed.Data.DeleteURL,
		SizeBytes: parsed.Data.Size,
	}, nil
}
