package id

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

// New returns a random identifier with a stable prefix.
func New(prefix string) string {
	buffer := make([]byte, 6)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}

	return prefix + "_" + hex.EncodeToString(buffer)
}

// Deterministic returns a stable identifier derived from a source value.
func Deterministic(prefix, source string) string {
	sum := sha256.Sum256([]byte(source))
	return prefix + "_" + hex.EncodeToString(sum[:8])
}
