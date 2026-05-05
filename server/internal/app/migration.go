/**
 * File: internal/app/migration.go
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
 * - errors
 * - fmt
 * - log/slog
 * - nido/server/internal/platform/config
 * - nido/server/internal/platform/sqlite
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
	"errors"
	"fmt"
	"log/slog"

	"nido/server/internal/platform/config"
	platformsqlite "nido/server/internal/platform/sqlite"
)

/**
 * Purpose:
 * Performs the applyMigrationPolicy operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, db *sql.DB, cfg config.MigrationConfig, logger *slog.Logger
 *
 * Returns:
 * - (platformsqlite.MigrationStatus, error)
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
