package objectstore

import (
	"context"
	"fmt"
	"sync"
)

// MemoryStore is an in-memory object-store used by tests and lightweight local runs.
type MemoryStore struct {
	mu      sync.RWMutex
	objects map[string][]byte
}

// NewMemoryStore builds an empty in-memory object-store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{objects: make(map[string][]byte)}
}

// Put stores a raw object in memory.
func (s *MemoryStore) Put(_ context.Context, input PutInput) (PutResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	copyOfBody := make([]byte, len(input.Body))
	copy(copyOfBody, input.Body)
	s.objects[input.Key] = copyOfBody

	return PutResult{Key: input.Key, Size: int64(len(copyOfBody))}, nil
}

// Get returns a previously stored object.
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
