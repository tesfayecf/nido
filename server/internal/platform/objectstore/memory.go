/**
 * File: internal/platform/objectstore/memory.go
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
 * - sync
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
	"sync"
)

/**
 * Purpose:
 * Defines the MemoryStore struct used by this package and its consumers.
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
type MemoryStore struct {
	mu      sync.RWMutex
	objects map[string][]byte
}

/**
 * Purpose:
 * Performs the NewMemoryStore operation for this backend package.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - *MemoryStore
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
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{objects: make(map[string][]byte)}
}

/**
 * Purpose:
 * Performs the Put operation for this backend package.
 *
 * Parameters:
 * - s *MemoryStore
 *
 * Returns:
 * - Put(_ context.Context, input PutInput) (PutResult, error)
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
func (s *MemoryStore) Put(_ context.Context, input PutInput) (PutResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	copyOfBody := make([]byte, len(input.Body))
	copy(copyOfBody, input.Body)
	s.objects[input.Key] = copyOfBody

	return PutResult{Key: input.Key, Size: int64(len(copyOfBody))}, nil
}

/**
 * Purpose:
 * Performs the Get operation for this backend package.
 *
 * Parameters:
 * - s *MemoryStore
 *
 * Returns:
 * - Get(_ context.Context, key string) ([]byte, error)
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
func (s *MemoryStore) Get(_ context.Context, key string) ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	body, ok := s.objects[key]
	if !ok {
		return nil, fmt.Errorf("object %q not found", key)
	}

	copyOfBody := make([]byte, len(body))
	copy(copyOfBody, body)

	return copyOfBody, nil
}
