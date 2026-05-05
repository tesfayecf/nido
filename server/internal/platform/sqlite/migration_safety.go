/**
 * File: internal/platform/sqlite/migration_safety.go
 *
 * Purpose:
 * Implements SQLite persistence and migration support for backend state.
 *
 * Responsibilities:
 * - Map domain objects to SQLite records
 * - Execute schema-aware reads and writes
 * - Preserve migration and backup safety guarantees
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
 * - os
 * - path/filepath
 * - strings
 * - time
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const SchemaVersion = 12

/**
 * @critical
 * Description: SQLite schema changes are guarded by integrity checks and pre-migration backups.
 * Why critical: A failed or unsafe migration can permanently alter the durable workspace database.
 * What can break: Backend startup, workspace recovery, property data, sessions, settings, and backup/restore flows.
 * Failure conditions: Unwritable backup directory, failed integrity check, concurrent writers, or an incorrect migration strategy.
 */

/**
 * Purpose:
 * Defines the MigrationStatus struct used by this package and its consumers.
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
type MigrationStatus struct {
	CurrentVersion int    `json:"current_version"`
	TargetVersion  int    `json:"target_version"`
	Pending        bool   `json:"pending"`
	Strategy       string `json:"strategy"`
	State          string `json:"state"`
	BackupPath     string `json:"backup_path,omitempty"`
	Error          string `json:"error,omitempty"`
}

/**
 * Purpose:
 * Performs the CurrentSchemaVersion operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, db *sql.DB
 *
 * Returns:
 * - (int, error)
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
func CurrentSchemaVersion(ctx context.Context, db *sql.DB) (int, error) {
	var version int
	if err := db.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&version); err != nil {
		return 0, fmt.Errorf("read sqlite schema version: %w", err)
	}
	return version, nil
}

/**
 * Purpose:
 * Performs the IntegrityCheck operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, db *sql.DB
 *
 * Returns:
 * - error
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
func IntegrityCheck(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `PRAGMA quick_check`)
	if err != nil {
		return fmt.Errorf("run sqlite integrity check: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var result string
		if err := rows.Scan(&result); err != nil {
			return fmt.Errorf("scan sqlite integrity check: %w", err)
		}
		if strings.TrimSpace(strings.ToLower(result)) != "ok" {
			return fmt.Errorf("sqlite integrity check failed: %s", result)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("read sqlite integrity check: %w", err)
	}
	return nil
}

/**
 * Purpose:
 * Performs the BackupDatabase operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context, db *sql.DB, backupDir string, schemaVersion int
 *
 * Returns:
 * - (string, error)
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
func BackupDatabase(ctx context.Context, db *sql.DB, backupDir string, schemaVersion int) (string, error) {
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}

	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05")
	version := "unknown"
	if schemaVersion >= 0 {
		version = fmt.Sprintf("v%d", schemaVersion)
	}
	path := filepath.Join(backupDir, fmt.Sprintf("backup_%s_%s.dump", timestamp, version))
	for attempt := 1; ; attempt++ {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			break
		}
		path = filepath.Join(backupDir, fmt.Sprintf("backup_%s_%s_%d.dump", timestamp, version, attempt))
	}

	if _, err := db.ExecContext(ctx, "VACUUM INTO ?", path); err != nil {
		return "", fmt.Errorf("write sqlite backup: %w", err)
	}
	return path, nil
}
