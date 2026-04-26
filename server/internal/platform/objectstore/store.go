package objectstore

import (
	"context"
	"fmt"
	"strings"

	"nido/server/internal/platform/config"
)

// PutInput describes a raw artifact upload request.
type PutInput struct {
	Key         string
	ContentType string
	Body        []byte
}

// PutResult describes the object that was stored.
type PutResult struct {
	Key  string
	Size int64
}

// Store is the storage abstraction used for raw ingest artifacts.
type Store interface {
	Put(ctx context.Context, input PutInput) (PutResult, error)
	Get(ctx context.Context, key string) ([]byte, error)
}

// New returns the configured object-store implementation.
func New(ctx context.Context, cfg config.ObjectStoreConfig) (Store, error) {
	switch strings.ToLower(cfg.Driver) {
	case "", "memory":
		return NewMemoryStore(), nil
	case "s3":
		return NewS3Store(ctx, cfg)
	default:
		return nil, fmt.Errorf("unsupported object store driver %q", cfg.Driver)
	}
}
