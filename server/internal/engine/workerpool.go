package engine

import (
	"context"
	"errors"
	"log/slog"
	"sync"
)

// ErrWorkerPoolClosed indicates that no additional tasks can be submitted.
var ErrWorkerPoolClosed = errors.New("worker pool closed")

// WorkerPoolConfig controls worker-pool execution.
type WorkerPoolConfig struct {
	Workers int
	Logger  *slog.Logger
}

// WorkerPool executes scraping work with graceful shutdown semantics.
type WorkerPool struct {
	logger *slog.Logger
	ctx    context.Context
	cancel context.CancelFunc
	tasks  chan func(context.Context) error

	mu     sync.RWMutex
	closed bool
	wg     sync.WaitGroup
}

// NewWorkerPool creates and starts a worker pool.
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

// Submit queues a task for execution.
func (p *WorkerPool) Submit(task func(context.Context) error) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.closed {
		return ErrWorkerPoolClosed
	}

	p.tasks <- task
	return nil
}

// Shutdown stops accepting new work and waits for active workers.
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
