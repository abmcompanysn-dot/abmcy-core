package platformconfig

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

// AES-GCM at rest for every value in platform_config. CONFIG_ENCRYPTION_KEY
// is the one secret that still MUST live in the environment — it's the key
// that unlocks everything else, so it can't itself be stored in the thing
// it protects.
type cryptor struct {
	gcm cipher.AEAD
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
