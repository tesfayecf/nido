package sqlite

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
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

func TestMigrateBackfillsPropertyFieldValuesOnExistingSnapshots(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("initial migrate database: %v", err)
	}

	observedAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, "property-1", "https://example.test/property/1", "Test Property", observedAt, observedAt)
	execTestStatement(t, db, `
		INSERT INTO property_extraction_configs (id, property_id, fields_json, version, created_at, change_summary)
		VALUES (?, ?, ?, ?, ?, ?)
	`, "config-1", "property-1", `[{"name":"price","field_name":"price"}]`, 1, observedAt, "")
	execTestStatement(t, db, `
		INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-1", "property-1", 1, observedAt, `{"price":"123000"}`, `{}`, 1, sql.NullString{})

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("rerun migrate database: %v", err)
	}

	var fieldName string
	var fieldDefinitionID sql.NullString
	var valueText string
	if err := db.QueryRowContext(
		context.Background(),
		`SELECT field_name, field_definition_id, value_text FROM property_field_values WHERE id = ?`,
		"snapshot-1:price",
	).Scan(&fieldName, &fieldDefinitionID, &valueText); err != nil {
		t.Fatalf("query backfilled property field value: %v", err)
	}

	if fieldName != "price" {
		t.Fatalf("expected field name price, got %q", fieldName)
	}
	if !fieldDefinitionID.Valid || fieldDefinitionID.String != "field-price" {
		t.Fatalf("expected field definition id field-price, got %+v", fieldDefinitionID)
	}
	if valueText != "123000" {
		t.Fatalf("expected value text 123000, got %q", valueText)
	}
}

func TestListAnalyticsRecordsAllowsNullSourceID(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "nido.db")
	db, err := Open(context.Background(), config.DatabaseConfig{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	store := NewStore(db)
	observedAt := time.Now().UTC().Format(time.RFC3339Nano)
	execTestStatement(t, db, `
		INSERT INTO properties (id, url, label, source_id, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, "property-null-source", "https://example.test/property/null-source", "Unassigned property", sql.NullString{}, "pending", observedAt, observedAt)
	execTestStatement(t, db, `
		INSERT INTO property_snapshots (id, property_id, config_version, observed_at, values_json, change_flags_json, is_valid, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-null-source", "property-null-source", 1, observedAt, `{"price":"190000"}`, `{}`, 1, sql.NullString{})
	execTestStatement(t, db, `
		INSERT INTO property_field_values
			(id, property_id, snapshot_id, field_definition_id, field_name, selector_name, config_version, value_text, observed_at, validation_status, validation_message, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "snapshot-null-source:price", "property-null-source", "snapshot-null-source", "field-price", "price", "price", 1, "190000", observedAt, ingestiondomain.FieldValidationStatusValid, "", observedAt)

	records, err := store.ListAnalyticsRecords(context.Background())
	if err != nil {
		t.Fatalf("list analytics records: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected one analytics record, got %d", len(records))
	}

	record := records[0]
	if record.PropertyID != "property-null-source" {
		t.Fatalf("expected property-null-source record, got %q", record.PropertyID)
	}
	if record.SourceID != "" {
		t.Fatalf("expected empty source id for partially configured property, got %q", record.SourceID)
	}
	if got := record.Values["price"]; got != "190000" {
		t.Fatalf("expected analytics price 190000, got %q", got)
	}
}

func execTestStatement(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()

	if _, err := db.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatalf("exec statement %q: %v", query, err)
	}
}
