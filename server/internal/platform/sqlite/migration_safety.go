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

// MigrationStatus describes the current schema state and last migration action.
type MigrationStatus struct {
	CurrentVersion int    `json:"current_version"`
	TargetVersion  int    `json:"target_version"`
	Pending        bool   `json:"pending"`
	Strategy       string `json:"strategy"`
	State          string `json:"state"`
	BackupPath     string `json:"backup_path,omitempty"`
	Error          string `json:"error,omitempty"`
}

// CurrentSchemaVersion returns SQLite's persisted schema version marker.
func CurrentSchemaVersion(ctx context.Context, db *sql.DB) (int, error) {
	var version int
	if err := db.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&version); err != nil {
		return 0, fmt.Errorf("read sqlite schema version: %w", err)
	}
	return version, nil
}

// IntegrityCheck runs a low-cost corruption check before operational work.
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

// BackupDatabase writes a consistent SQLite backup file into backupDir.
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
