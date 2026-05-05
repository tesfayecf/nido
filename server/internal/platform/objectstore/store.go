/**
 * File: internal/platform/objectstore/store.go
 *
 * Purpose:
 * Implements backend behavior for the objectstore package.
 *
 * Responsibilities:
 * - Provide package-specific backend behavior
 * - Keep dependencies explicit
 * - Return deterministic values to callers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - context
 * - fmt
 * - strings
 * - nido/server/internal/platform/config
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package objectstore

import (
	"context"
	"fmt"
	"strings"

	"nido/server/internal/platform/config"
)

/**
 * Purpose:
 * Defines the PutInput struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type PutInput struct {
	Key         string
	ContentType string
	Body        []byte
}

/**
 * Purpose:
 * Defines the PutResult struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type PutResult struct {
	Key  string
	Size int64
}

/**
 * Purpose:
 * Defines the Store interface used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type Store interface {
	Put(ctx context.Context, input PutInput) (PutResult, error)
	Get(ctx context.Context, key string) ([]byte, error)
}

/**
 * Purpose:
 * Performs the New operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, cfg config.ObjectStoreConfig
 *
 * Returns:
 * - (Store, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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
