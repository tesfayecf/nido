/**
 * File: internal/engine/workerpool.go
 *
 * Purpose:
 * Implements backend behavior for the engine package.
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
 * - errors
 * - log/slog
 * - sync
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package engine

import (
	"context"
	"errors"
	"log/slog"
	"sync"
)

// ErrWorkerPoolClosed indicates that no additional tasks can be submitted.
var ErrWorkerPoolClosed = errors.New("worker pool closed")

/**
 * Purpose:
 * Defines the WorkerPoolConfig struct used by this package and its consumers.
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
type WorkerPoolConfig struct {
	Workers int
	Logger  *slog.Logger
}

/**
 * Purpose:
 * Defines the WorkerPool struct used by this package and its consumers.
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
type WorkerPool struct {
	logger *slog.Logger
	ctx    context.Context
	cancel context.CancelFunc
	tasks  chan func(context.Context) error

	mu     sync.RWMutex
	closed bool
	wg     sync.WaitGroup
}

/**
 * Purpose:
 * Performs the NewWorkerPool operation for this backend package.
 *
 * Parameters:
 * - cfg WorkerPoolConfig
 *
 * Returns:
 * - *WorkerPool
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func NewWorkerPool(cfg WorkerPoolConfig) *WorkerPool {
	workers := cfg.Workers
	if workers <= 0 {
		workers = 1
	}

	ctx, cancel := context.WithCancel(context.Background())
	pool := &WorkerPool{
		logger: cfg.Logger,
		ctx:    ctx,
		cancel: cancel,
		tasks:  make(chan func(context.Context) error, workers*2),
	}

	pool.wg.Add(workers)
	for range workers {
		go func() {
			defer pool.wg.Done()
			for task := range pool.tasks {
				if task == nil {
					continue
				}
				if err := task(pool.ctx); err != nil && !errors.Is(err, context.Canceled) && pool.logger != nil {
					pool.logger.Error("worker task failed", "error", err.Error())
				}
			}
		}()
	}

	return pool
}

/**
 * Purpose:
 * Performs the Submit operation for this backend package.
 *
 * Parameters:
 * - p *WorkerPool
 *
 * Returns:
 * - Submit(task func(context.Context) error) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (p *WorkerPool) Submit(task func(context.Context) error) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.closed {
		return ErrWorkerPoolClosed
	}

	p.tasks <- task
	return nil
}

/**
 * Purpose:
 * Performs the Shutdown operation for this backend package.
 *
 * Parameters:
 * - p *WorkerPool
 *
 * Returns:
 * - Shutdown(ctx context.Context) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (p *WorkerPool) Shutdown(ctx context.Context) error {
	p.mu.Lock()
	if !p.closed {
		p.closed = true
		close(p.tasks)
	}
	p.mu.Unlock()

	done := make(chan struct{})
	go func() {
		defer close(done)
		p.wg.Wait()
	}()

	select {
	case <-done:
		p.cancel()
		return nil
	case <-ctx.Done():
		p.cancel()
		<-done
		return ctx.Err()
	}
}
