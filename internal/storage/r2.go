package storage

import (
	"bytes"
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// R2Client uploads image bytes to a Cloudflare R2 bucket. R2 speaks the S3
// API, so we reuse the AWS SDK pointed at R2's account-scoped endpoint
// instead of a Cloudflare-specific client. Unlike imgbb, R2 charges no
// egress fees and gives ABMCY a bucket it actually controls (retention,
// deletion, per-tenant prefixes), at the cost of needing a public bucket
// domain to serve the uploaded files from.
type R2Client struct {
	s3Client  *s3.Client
	bucket    string
	publicURL string // e.g. "https://img.abmcy.com", no trailing slash
}

type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	PublicURL       string
}

// ErrNotConfigured is returned whenever R2 credentials haven't been set
// yet from the super-admin dashboard (Configuration page). Callers map it
// to a 503 rather than treating it as an unexpected failure.
var ErrNotConfigured = fmt.Errorf("r2: not configured")

func NewR2Client(cfg R2Config) (*R2Client, error) {
	if cfg.AccountID == "" || cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" || cfg.Bucket == "" || cfg.PublicURL == "" {
		return nil, ErrNotConfigured
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)

	client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       "auto", // R2 ignores region but the SDK requires a value
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
	})

	return &R2Client{
		s3Client:  client,
		bucket:    cfg.Bucket,
		publicURL: cfg.PublicURL,
	}, nil
}

// Upload stores raw image bytes under a random object key (namespaced by
// tenant so a leaked object key from one tenant can't be guessed for
// another) and returns the public URL served via the bucket's custom
// domain (configured separately in the Cloudflare dashboard).
func (c *R2Client) Upload(ctx context.Context, tenantID uuid.UUID, filename string, contentType string, data []byte) (*UploadResult, error) {
	key := fmt.Sprintf("%s/%s-%s", tenantID.String(), uuid.NewString(), filename)

	_, err := c.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return nil, fmt.Errorf("r2: put object: %w", err)
	}

	return &UploadResult{
		URL:       c.publicURL + "/" + key,
		SizeBytes: int64(len(data)),
	}, nil
}

// UploadResult is returned by any storage backend upload.
type UploadResult struct {
	URL       string
	SizeBytes int64
}

// Delete removes an object by its full public URL, used when a product
// image is deleted and should no longer count against the tenant's quota.
func (c *R2Client) Delete(ctx context.Context, publicURL string) error {
	key := publicURL[len(c.publicURL)+1:]
	_, err := c.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("r2: delete object: %w", err)
	}
	return nil
}
