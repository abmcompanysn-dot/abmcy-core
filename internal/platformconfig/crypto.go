package platformconfig

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

// Cryptor does AES-GCM at rest for secrets that can't themselves live in
// platform_config. CONFIG_ENCRYPTION_KEY is the one secret that still MUST
// live in the environment — it's the key that unlocks everything else.
// Exported so other packages that store per-tenant secrets (e.g.
// internal/tenantpayment) can reuse the exact same scheme.
type Cryptor = cryptor

type cryptor struct {
	gcm cipher.AEAD
}

// NewCryptor builds a Cryptor from a base64-encoded 32-byte (AES-256) key.
func NewCryptor(base64Key string) (*Cryptor, error) {
	return newCryptor(base64Key)
}

func newCryptor(base64Key string) (*cryptor, error) {
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("platformconfig: CONFIG_ENCRYPTION_KEY is not valid base64: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("platformconfig: CONFIG_ENCRYPTION_KEY must decode to 32 bytes (AES-256), got %d", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("platformconfig: init cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("platformconfig: init gcm: %w", err)
	}
	return &cryptor{gcm: gcm}, nil
}

// Encrypt is the exported form of encrypt, for callers in other packages.
func (c *cryptor) Encrypt(plaintext string) ([]byte, error) { return c.encrypt(plaintext) }

// Decrypt is the exported form of decrypt, for callers in other packages.
func (c *cryptor) Decrypt(ciphertext []byte) (string, error) { return c.decrypt(ciphertext) }

func (c *cryptor) encrypt(plaintext string) ([]byte, error) {
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("platformconfig: generate nonce: %w", err)
	}
	return c.gcm.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

func (c *cryptor) decrypt(ciphertext []byte) (string, error) {
	nonceSize := c.gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("platformconfig: ciphertext too short")
	}
	nonce, encrypted := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := c.gcm.Open(nil, nonce, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("platformconfig: decrypt: %w", err)
	}
	return string(plaintext), nil
}
