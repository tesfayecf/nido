package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nido/server/internal/app"
	"nido/server/internal/platform/config"
	platformsqlite "nido/server/internal/platform/sqlite"
	"nido/server/internal/seed"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	command := "serve"
	if len(args) > 0 {
		command = args[0]
	}

	switch command {
	case "serve":
		return serve(cfg, logger)
	case "migrate":
		return migrate(cfg)
	case "seed":
		variant := ""
		if len(args) > 1 {
			variant = args[1]
		}
		return seedDatabase(cfg, variant)
	default:
		return fmt.Errorf("unknown command %q", command)
	}
}

func serve(cfg config.Config, logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	runtime, err := app.New(ctx, cfg, logger)
	if err != nil {
		return err
	}
	defer runtime.Close()

	server := &http.Server{
		Addr:              cfg.HTTP.Address,
		Handler:           runtime.Handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	logger.Info("server starting",
		"addr", cfg.HTTP.Address,
		"database", cfg.Database.Path,
		"object_store", cfg.ObjectStore.Driver,
	)

	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}

		return err
	}
}

func migrate(cfg config.Config) error {
	ctx := context.Background()
	db, err := platformsqlite.Open(ctx, cfg.Database)
	if err != nil {
		return err
	}
	defer db.Close()

	currentVersion, err := platformsqlite.CurrentSchemaVersion(ctx, db)
	if err != nil {
		return err
	}
	if currentVersion != platformsqlite.SchemaVersion {
		if err := platformsqlite.IntegrityCheck(ctx, db); err != nil {
			return err
		}
		backupPath, err := platformsqlite.BackupDatabase(ctx, db, cfg.Migration.BackupDir, currentVersion)
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "pre-migration backup created at %s\n", backupPath)
	}
	if err := platformsqlite.Migrate(ctx, db); err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "sqlite schema ready at %s\n", cfg.Database.Path)
	return nil
}

func seedDatabase(cfg config.Config, variant string) error {
	ctx := context.Background()
	db, err := platformsqlite.Open(ctx, cfg.Database)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := platformsqlite.Migrate(ctx, db); err != nil {
		return err
	}
	if err := seed.Apply(ctx, db, seed.Options{Variant: variant}); err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "seed data ready at %s\n", cfg.Database.Path)
	return nil
}
