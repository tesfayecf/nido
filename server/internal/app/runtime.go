/**
 * File: internal/app/runtime.go
 *
 * Purpose:
 * Composes the backend runtime, dependencies, routes, and lifecycle behavior.
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
 * - database/sql
 * - fmt
 * - log/slog
 * - net/http
 * - time
 * - nido/server/internal/auth/application
 * - nido/server/internal/auth/transport/httpapi
 * - nido/server/internal/engagement/application
 * - nido/server/internal/engagement/transport/httpapi
 * - nido/server/internal/fetcher
 * - nido/server/internal/ingestion/application
 * - nido/server/internal/ingestion/browser
 * - nido/server/internal/ingestion/transport/httpapi
 * - nido/server/internal/platform/config
 * - nido/server/internal/platform/events
 * - nido/server/internal/platform/httpapi
 * - nido/server/internal/platform/sqlite
 * - nido/server/internal/platformops/application
 * - nido/server/internal/platformops/transport/httpapi
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	authapp "nido/server/internal/auth/application"
	authhttp "nido/server/internal/auth/transport/httpapi"
	engagementapp "nido/server/internal/engagement/application"
	engagementhttp "nido/server/internal/engagement/transport/httpapi"
	"nido/server/internal/fetcher"
	ingestionapp "nido/server/internal/ingestion/application"
	"nido/server/internal/ingestion/browser"
	ingestionhttp "nido/server/internal/ingestion/transport/httpapi"
	"nido/server/internal/platform/config"
	platformevents "nido/server/internal/platform/events"
	platformhttp "nido/server/internal/platform/httpapi"
	platformsqlite "nido/server/internal/platform/sqlite"
	platformopsapp "nido/server/internal/platformops/application"
	platformopshttp "nido/server/internal/platformops/transport/httpapi"
)

/**
 * Purpose:
 * Defines the Runtime struct used by this package and its consumers.
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
type Runtime struct {
	Handler           http.Handler
	db                *sql.DB
	cancel            context.CancelFunc
	propertyScheduler *ingestionapp.PropertyScheduler
	platformService   *platformopsapp.Service
	MigrationStatus   platformsqlite.MigrationStatus
}

/**
 * Purpose:
 * Performs the New operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, cfg config.Config, logger *slog.Logger
 *
 * Returns:
 * - (*Runtime, error)
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
func New(ctx context.Context, cfg config.Config, logger *slog.Logger) (*Runtime, error) {
	runtimeCtx, cancel := context.WithCancel(ctx)

	db, err := platformsqlite.Open(ctx, cfg.Database)
	if err != nil {
		cancel()
		return nil, err
	}

	migrationStatus, err := applyMigrationPolicy(ctx, db, cfg.Migration, logger)
	if err != nil {
		cancel()
		_ = db.Close()
		return nil, err
	}

	eventBroker := platformevents.NewBroker()
	store := platformsqlite.NewStore(db)
	renderer := browser.NewRenderer(cfg.Browser)
	propertyFetcher := fetcher.New(fetcher.Config{
		Logger:          logger,
		Timeout:         cfg.Fetcher.Timeout,
		ProxyProvider:   cfg.Fetcher.ProxyProvider,
		TLSProfile:      cfg.Fetcher.TLSProfile,
		MinRequestGap:   cfg.Fetcher.MinRequestGap,
		BreakerInterval: cfg.Fetcher.BreakerInterval,
		BreakerTimeout:  cfg.Fetcher.BreakerTimeout,
	}, renderer)
	authService := authapp.NewService(logger, store, cfg.Auth)
	if _, err := authService.EnsureBootstrapUser(runtimeCtx); err != nil {
		cancel()
		_ = db.Close()
		return nil, fmt.Errorf("ensure bootstrap admin: %w", err)
	}
	engagementService := engagementapp.NewService(logger, store, engagementapp.NewNotifier(logger, cfg.Notifications), eventBroker)
	sourceService, err := ingestionapp.NewService(logger, store, nil, nil, nil, cfg.Scheduler.LockTTL, nil, eventBroker)
	if err != nil {
		cancel()
		_ = db.Close()
		return nil, err
	}
	propertyService := ingestionapp.NewPropertyService(logger, store, propertyFetcher, nil, engagementService, eventBroker)
	fieldService := ingestionapp.NewFieldService(logger, store, nil)
	tagService := ingestionapp.NewTagService(logger, store, nil, eventBroker)

	// Create property scheduler
	propertyScheduler := ingestionapp.NewPropertyScheduler(
		logger,
		store,
		propertyService,
		nil,
		eventBroker,
		ingestionapp.PropertySchedulerConfig{
			TickInterval:         cfg.Scheduler.TickInterval,
			GlobalConcurrency:    4,
			PerDomainConcurrency: 1,
		},
	)
	propertyScheduler.Start()
	platformService := platformopsapp.NewService(logger, store, eventBroker, propertyScheduler, cfg.Notifications, cfg.Migration.BackupDir)
	platformService.Start()

	mux := http.NewServeMux()
	registerHealthEndpoints(mux, db, migrationStatus)
	authhttp.Register(mux, authService)
	authMiddleware := authhttp.Middleware(authService)
	engagementhttp.Register(mux, authMiddleware, engagementService)
	ingestionhttp.Register(mux, authMiddleware, sourceService)
	ingestionhttp.RegisterRuns(mux, authMiddleware, propertyService)
	ingestionhttp.RegisterProperties(mux, authMiddleware, propertyService)
	ingestionhttp.RegisterFields(mux, authMiddleware, fieldService)
	ingestionhttp.RegisterTags(mux, authMiddleware, tagService, propertyService)
	platformopshttp.Register(mux, authMiddleware, platformService)

	return &Runtime{
		Handler:           platformhttp.LoggingMiddleware(logger, platformhttp.CORSMiddleware(mux)),
		db:                db,
		cancel:            cancel,
		propertyScheduler: propertyScheduler,
		platformService:   platformService,
		MigrationStatus:   migrationStatus,
	}, nil
}

/**
 * Purpose:
 * Performs the Close operation for this backend package.
 *
 * Parameters:
 * - r *Runtime
 *
 * Returns:
 * - Close() error
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
func (r *Runtime) Close() error {
	if r.cancel != nil {
		r.cancel()
	}
	if r.platformService != nil {
		r.platformService.Stop()
	}
	if r.propertyScheduler != nil {
		r.propertyScheduler.Stop()
	}
	return r.db.Close()
}

/**
 * Purpose:
 * Performs the registerHealthEndpoints operation for this backend package.
 *
 * Parameters:
 * - mux *http.ServeMux, db *sql.DB, migrationStatus platformsqlite.MigrationStatus
 *
 * Returns:
 * - None.
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
func registerHealthEndpoints(mux *http.ServeMux, db *sql.DB, migrationStatus platformsqlite.MigrationStatus) {
	mux.HandleFunc("GET /api/v1/health/live", func(w http.ResponseWriter, r *http.Request) {
		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/v1/health/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		if err := db.PingContext(ctx); err != nil {
			platformhttp.WriteError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})

	mux.HandleFunc("GET /api/v1/platform/migration/status", func(w http.ResponseWriter, r *http.Request) {
		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": migrationStatus})
	})
}
