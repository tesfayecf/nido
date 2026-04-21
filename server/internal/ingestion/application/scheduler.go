package application

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"home-searcher/server/internal/engine"
)

// Scheduler periodically triggers due ingestion sources.
type Scheduler struct {
	logger          *slog.Logger
	service         *Service
	tickInterval    time.Duration
	batchSize       int
	shutdownTimeout time.Duration
	done            chan struct{}
	waitOnce        sync.Once
}

// NewScheduler builds a background scheduler.
func NewScheduler(logger *slog.Logger, service *Service, tickInterval time.Duration, batchSize int, shutdownTimeout time.Duration) *Scheduler {
	if tickInterval <= 0 {
		tickInterval = 15 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 10
	}
	if shutdownTimeout <= 0 {
		shutdownTimeout = 30 * time.Second
	}

	return &Scheduler{
		logger:          logger,
		service:         service,
		tickInterval:    tickInterval,
		batchSize:       batchSize,
		shutdownTimeout: shutdownTimeout,
		done:            make(chan struct{}),
	}
}

// Start runs the scheduler until the context is cancelled.
func (s *Scheduler) Start(ctx context.Context) {
	defer close(s.done)

	pool := engine.NewWorkerPool(engine.WorkerPoolConfig{Workers: s.batchSize, Logger: s.logger})
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), s.shutdownTimeout)
		defer cancel()
		if err := pool.Shutdown(shutdownCtx); err != nil && s.logger != nil && !errors.Is(err, context.DeadlineExceeded) {
			s.logger.Error("scheduler worker shutdown failed", "error", err.Error())
		}
	}()

	ticker := time.NewTicker(s.tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sources, now, err := s.service.dueSources(ctx, s.batchSize)
			if err != nil {
				if s.logger != nil {
					s.logger.Error("scheduler tick failed", "error", err.Error())
				}
				continue
			}

			for _, source := range sources {
				source := source
				if err := pool.Submit(func(taskCtx context.Context) error {
					return s.service.runDueSource(taskCtx, source, now)
				}); err != nil && s.logger != nil {
					s.logger.Error("scheduler submit failed", "source_id", source.ID, "error", err.Error())
				}
			}
		}
	}
}

// Wait blocks until the scheduler loop and active workers stop.
func (s *Scheduler) Wait(ctx context.Context) error {
	select {
	case <-s.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
