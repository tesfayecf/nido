package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"nido/server/internal/platform/config"
	platformsqlite "nido/server/internal/platform/sqlite"
)

func applyMigrationPolicy(ctx context.Context, db *sql.DB, cfg config.MigrationConfig, logger *slog.Logger) (platformsqlite.MigrationStatus, error) {
	if cfg.Strategy == "" {
		cfg.Strategy = "safe-auto"
	}
	if cfg.BackupDir == "" {
		cfg.BackupDir = "/app/backups"
	}
	currentVersion, err := platformsqlite.CurrentSchemaVersion(ctx, db)
	if err != nil {
		return platformsqlite.MigrationStatus{}, err
	}
	status := platformsqlite.MigrationStatus{
		CurrentVersion: currentVersion,
		TargetVersion:  platformsqlite.SchemaVersion,
		Pending:        currentVersion != platformsqlite.SchemaVersion,
		Strategy:       cfg.Strategy,
		State:          "ready",
	}
	if err := platformsqlite.IntegrityCheck(ctx, db); err != nil {
		status.State = "integrity-failed"
		status.Error = err.Error()
		return status, err
	}
	if !status.Pending {
		return status, nil
	}
	if !cfg.AutoMigrate || cfg.Strategy == "manual" {
		status.State = "pending-manual"
		return status, nil
	}
	if cfg.Strategy != "safe-auto" {
		status.State = "migration-failed"
		status.Error = fmt.Sprintf("unsupported migration strategy %q", cfg.Strategy)
		return status, errors.New(status.Error)
	}

	backupPath, err := platformsqlite.BackupDatabase(ctx, db, cfg.BackupDir, currentVersion)
	if err != nil {
		status.State = "backup-failed"
		status.Error = err.Error()
		return status, err
	}
	status.BackupPath = backupPath
	if logger != nil {
		logger.Info("pre-migration backup created", "path", backupPath, "current_schema_version", currentVersion, "target_schema_version", platformsqlite.SchemaVersion)
	}

	if err := platformsqlite.Migrate(ctx, db); err != nil {
		status.State = "migration-failed"
		status.Error = err.Error()
		return status, err
	}
	if err := platformsqlite.IntegrityCheck(ctx, db); err != nil {
		status.State = "integrity-failed"
		status.Error = err.Error()
		return status, err
	}
	status.CurrentVersion = platformsqlite.SchemaVersion
	status.Pending = false
	status.State = "migrated"
	return status, nil
}
