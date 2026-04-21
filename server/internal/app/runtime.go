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
	catalogapp "home-searcher/server/internal/catalog/application"
	cataloghttp "home-searcher/server/internal/catalog/transport/httpapi"
	engagementapp "home-searcher/server/internal/engagement/application"
	engagementhttp "home-searcher/server/internal/engagement/transport/httpapi"
	"home-searcher/server/internal/fetcher"
	ingestionapp "home-searcher/server/internal/ingestion/application"
	"home-searcher/server/internal/ingestion/browser"
	"home-searcher/server/internal/ingestion/connectors/htmljsonld"
	"home-searcher/server/internal/ingestion/connectors/htmllistings"
	"home-searcher/server/internal/ingestion/connectors/httpjson"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	ingestionhttp "home-searcher/server/internal/ingestion/transport/httpapi"
	"home-searcher/server/internal/platform/config"
	platformevents "home-searcher/server/internal/platform/events"
	platformhttp "home-searcher/server/internal/platform/httpapi"
	"home-searcher/server/internal/platform/objectstore"
	platformsqlite "home-searcher/server/internal/platform/sqlite"
)

// Runtime owns the backend process dependencies and HTTP handler.
type Runtime struct {
	Handler         http.Handler
	db              *sql.DB
	cancel          context.CancelFunc
	scheduler       *ingestionapp.Scheduler
	shutdownTimeout time.Duration
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

	artifactStore, err := objectstore.New(ctx, cfg.ObjectStore)
	if err != nil {
		cancel()
		_ = db.Close()
		return nil, err
	}

	eventBroker := platformevents.NewBroker()
	store := platformsqlite.NewStore(db)
	catalogService := catalogapp.NewService(store)
	authService := authapp.NewService(logger, store, cfg.Auth)
	if _, err := authService.EnsureBootstrapUser(runtimeCtx); err != nil {
		cancel()
		_ = db.Close()
		return nil, fmt.Errorf("ensure bootstrap admin: %w", err)
	}
	engagementService := engagementapp.NewService(logger, store, engagementapp.NewNotifier(logger, cfg.Notifications), eventBroker)
	browserRenderer := browser.NewRenderer(cfg.Browser)
	sharedFetcher := fetcher.New(fetcher.Config{
		Logger:          logger,
		Timeout:         cfg.Fetcher.Timeout,
		ProxyProvider:   cfg.Fetcher.ProxyProvider,
		TLSProfile:      cfg.Fetcher.TLSProfile,
		BreakerInterval: cfg.Fetcher.BreakerInterval,
		BreakerTimeout:  cfg.Fetcher.BreakerTimeout,
	}, browserRenderer)
	ingestionService, err := ingestionapp.NewService(logger, store, artifactStore, []ingestionapp.Connector{
		httpjson.NewConnector(sharedFetcher),
		htmllistings.NewConnector(sharedFetcher, browserRenderer),
		htmljsonld.NewConnector(sharedFetcher, browserRenderer),
	}, nil, cfg.Scheduler.LockTTL, engagementService, eventBroker)
	if err != nil {
		cancel()
		_ = db.Close()
		return nil, err
	}

	if cfg.BootstrapSource.EndpointURL != "" {
		if _, err := ingestionService.EnsureSource(ctx, ingestiondomain.Source{
			ID:                      cfg.BootstrapSource.ID,
			Name:                    cfg.BootstrapSource.Name,
			Kind:                    cfg.BootstrapSource.Kind,
			EndpointURL:             cfg.BootstrapSource.EndpointURL,
			ConfigJSON:              cfg.BootstrapSource.ConfigJSON,
			BrowserEnabled:          cfg.BootstrapSource.BrowserEnabled,
			Active:                  true,
			RateLimitWindowSeconds:  cfg.BootstrapSource.RateLimitWindowSeconds,
			RateLimitMaxRequests:    cfg.BootstrapSource.RateLimitMaxRequests,
			RetryMaxAttempts:        cfg.BootstrapSource.RetryMaxAttempts,
			RetryBackoffMillis:      cfg.BootstrapSource.RetryBackoffMillis,
			ScheduleIntervalSeconds: cfg.BootstrapSource.ScheduleIntervalSeconds,
			FreshnessWindowSeconds:  cfg.BootstrapSource.FreshnessWindowSeconds,
		}); err != nil {
			cancel()
			_ = db.Close()
			return nil, fmt.Errorf("ensure bootstrap source: %w", err)
		}
	}

	var scheduler *ingestionapp.Scheduler
	if cfg.Scheduler.Enabled {
		scheduler = ingestionapp.NewScheduler(logger, ingestionService, cfg.Scheduler.TickInterval, cfg.Scheduler.BatchSize, cfg.Scheduler.ShutdownTimeout)
		go scheduler.Start(runtimeCtx)
	}

	mux := http.NewServeMux()
	registerHealthEndpoints(mux, db)
	cataloghttp.Register(mux, catalogService)
	authhttp.Register(mux, authService)
	authMiddleware := authhttp.Middleware(authService)
	engagementhttp.Register(mux, authMiddleware, engagementService)
	ingestionhttp.Register(mux, authMiddleware, ingestionService, eventBroker)

	propertyService := ingestionapp.NewPropertyService(logger, store, nil, engagementService, eventBroker)
	ingestionhttp.RegisterProperties(mux, authMiddleware, propertyService)

	return &Runtime{
		Handler:         platformhttp.LoggingMiddleware(logger, mux),
		db:              db,
		cancel:          cancel,
		scheduler:       scheduler,
		shutdownTimeout: cfg.Scheduler.ShutdownTimeout,
	}, nil
}

// Close releases the runtime resources.
func (r *Runtime) Close() error {
	if r.cancel != nil {
		r.cancel()
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
