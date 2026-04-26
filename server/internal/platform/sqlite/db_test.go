package sqlite

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"nido/server/internal/platform/config"
)

func TestOpenRecoversCorruptDatabaseFile(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	corruptContents := []byte("this is not a sqlite database")
	if err := os.WriteFile(databasePath, corruptContents, 0o644); err != nil {
		t.Fatalf("write corrupt database: %v", err)
	}

	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	backups, err := filepath.Glob(databasePath + ".corrupt-*")
	if err != nil {
		t.Fatalf("glob backup databases: %v", err)
	}
	if len(backups) != 1 {
		t.Fatalf("expected exactly one corrupt database backup, got %v", backups)
	}

	backupContents, err := os.ReadFile(backups[0])
	if err != nil {
		t.Fatalf("read backup database: %v", err)
	}
	if string(backupContents) != string(corruptContents) {
		t.Fatalf("unexpected backup contents: %q", string(backupContents))
	}

	var tableCount int
	if err := db.QueryRowContext(
		context.Background(),
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'users'",
	).Scan(&tableCount); err != nil {
		t.Fatalf("query sqlite schema: %v", err)
	}
	if tableCount != 1 {
		t.Fatalf("expected migrated users table, got %d matches", tableCount)
	}
}
