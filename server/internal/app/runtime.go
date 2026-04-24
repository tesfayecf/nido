package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	authapp "home-searcher/server/internal/auth/application"
	authhttp "home-searcher/server/internal/auth/transport/httpapi"
	engagementapp "home-searcher/server/internal/engagement/application"
	engagementhttp "home-searcher/server/internal/engagement/transport/httpapi"
	"home-searcher/server/internal/fetcher"
	ingestionapp "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/browser"
	ingestionhttp "home-searcher/server/internal/ingestion/transport/httpapi"
	"home-searcher/server/internal/platform/config"
	platformevents "home-searcher/server/internal/platform/events"
	platformhttp "home-searcher/server/internal/platform/httpapi"
	platformsqlite "home-searcher/server/internal/platform/sqlite"
	platformopsapp "home-searcher/server/internal/platformops/application"
	platformopshttp "home-searcher/server/internal/platformops/transport/httpapi"
)

// Runtime owns the backend process dependencies and HTTP handler.
type Runtime struct {
	Handler           http.Handler
	db                *sql.DB
	cancel            context.CancelFunc
	scheduler         *ingestionapp.Scheduler
	propertyScheduler *ingestionapp.PropertyScheduler
	platformService   *platformopsapp.Service
	shutdownTimeout   time.Duration
}

// New builds the operational backend runtime.
func New(ctx context.Context, cfg config.Config, logger *slog.Logger) (*Runtime, error) {
	runtimeCtx, cancel := context.WithCancel(ctx)

	db, err := platformsqlite.Open(ctx, cfg.Database)
	if err != nil {
		cancel()
		return nil, err
	}

	if err := platformsqlite.Migrate(ctx, db); err != nil {
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
	platformService := platformopsapp.NewService(logger, store, eventBroker, propertyScheduler, cfg.Notifications)
	platformService.Start()

	mux := http.NewServeMux()
	registerHealthEndpoints(mux, db)
	authhttp.Register(mux, authService)
	authMiddleware := authhttp.Middleware(authService)
	engagementhttp.Register(mux, authMiddleware, engagementService)
	ingestionhttp.Register(mux, authMiddleware, sourceService, eventBroker)
	ingestionhttp.RegisterRuns(mux, authMiddleware, propertyService)
	ingestionhttp.RegisterProperties(mux, authMiddleware, propertyService)
	ingestionhttp.RegisterFields(mux, authMiddleware, fieldService)
	ingestionhttp.RegisterTags(mux, authMiddleware, tagService, propertyService)
	platformopshttp.Register(mux, authMiddleware, platformService)

	return &Runtime{
		Handler:           platformhttp.LoggingMiddleware(logger, mux),
		db:                db,
		cancel:            cancel,
		scheduler:         nil,
		propertyScheduler: propertyScheduler,
		platformService:   platformService,
		shutdownTimeout:   cfg.Scheduler.ShutdownTimeout,
	}, nil
}

// Close releases the runtime resources.
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
	if r.scheduler != nil {
		waitCtx, cancel := context.WithTimeout(context.Background(), r.shutdownTimeout)
		defer cancel()
		if err := r.scheduler.Wait(waitCtx); err != nil {
			return err
		}
	}
	return r.db.Close()
}

func registerHealthEndpoints(mux *http.ServeMux, db *sql.DB) {
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
}
