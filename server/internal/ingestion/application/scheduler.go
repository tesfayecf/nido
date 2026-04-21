package application

import (
	"context"
	"log/slog"
	"time"
)

// Scheduler periodically triggers due ingestion sources.
type Scheduler struct {
	logger       *slog.Logger
	service      *Service
	tickInterval time.Duration
	batchSize    int
}

// NewScheduler builds a background scheduler.
func NewScheduler(logger *slog.Logger, service *Service, tickInterval time.Duration, batchSize int) *Scheduler {
	if tickInterval <= 0 {
		tickInterval = 15 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 10
	}

	return &Scheduler{logger: logger, service: service, tickInterval: tickInterval, batchSize: batchSize}
}

// Start runs the scheduler until the context is cancelled.
func (s *Scheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(s.tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.service.RunDueSources(ctx, s.batchSize); err != nil {
				s.logger.Error("scheduler tick failed", "error", err.Error())
			}
		}
	}
}
