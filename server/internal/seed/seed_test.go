package seed

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"nido/server/internal/platform/config"
	platformsqlite "nido/server/internal/platform/sqlite"
)

func TestApplyShouldPopulateDeterministicDataWhenDatabaseIsEmpty(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := newSeedDatabase(t, ctx)
	now := time.Date(2026, 4, 26, 20, 20, 34, 0, time.UTC)

	before := countRows(t, db, "properties")
	if before != 0 {
		t.Fatalf("expected empty properties table before seed, got %d", before)
	}

	if err := Apply(ctx, db, Options{Variant: "qa", Now: now, Env: "development"}); err != nil {
		t.Fatalf("apply seed: %v", err)
	}

	assertCount(t, db, "sources", 2)
	assertCount(t, db, "properties", 4)
	assertCount(t, db, "tags", 3)
	assertCount(t, db, "property_snapshots", 3)
	assertCount(t, db, "bookmarks", 1)
	assertCount(t, db, "alert_rules", 1)
	assertCount(t, db, "notifications", 1)

	var label, status, metadata string
	if err := db.QueryRowContext(ctx, `SELECT label, status, metadata_json FROM properties WHERE id = ?`, "seed-qa-prop-bilbao-flat").Scan(&label, &status, &metadata); err != nil {
		t.Fatalf("query seeded property: %v", err)
	}
	if label != "Seed Bilbao riverside flat" || status != "active" {
		t.Fatalf("unexpected seeded property label/status: %q/%q", label, status)
	}
	if metadata == "" || metadata == "{}" {
		t.Fatalf("expected seeded metadata, got %q", metadata)
	}
}

func TestApplyShouldRemainIdempotentWhenRunMultipleTimes(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := newSeedDatabase(t, ctx)

	for i := 0; i < 3; i++ {
		if err := Apply(ctx, db, Options{Variant: "repeat", Env: "local"}); err != nil {
			t.Fatalf("apply seed run %d: %v", i+1, err)
		}
	}

	assertCount(t, db, "sources", 2)
	assertCount(t, db, "properties", 4)
	assertCount(t, db, "property_tags", 3)
	assertCount(t, db, "users", 1)
	assertCount(t, db, "ingestion_runs", 1)
}

func TestApplyShouldRejectProductionEnvironmentWhenSeedRequested(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := newSeedDatabase(t, ctx)

	if err := Apply(ctx, db, Options{Env: "production"}); !errors.Is(err, ErrProductionEnvironment) {
		t.Fatalf("expected production environment error, got %v", err)
	}
	assertCount(t, db, "properties", 0)
}

func newSeedDatabase(t *testing.T, ctx context.Context) *sql.DB {
	t.Helper()

	db, err := platformsqlite.Open(ctx, config.DatabaseConfig{Path: filepath.Join(t.TempDir(), "seed.db")})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	if err := platformsqlite.Migrate(ctx, db); err != nil {
		t.Fatalf("migrate sqlite: %v", err)
	}
	return db
}

func assertCount(t *testing.T, db *sql.DB, table string, want int) {
	t.Helper()

	got := countRows(t, db, table)
	if got != want {
		t.Fatalf("unexpected %s count: got %d want %d", table, got, want)
	}
}

func countRows(t *testing.T, db *sql.DB, table string) int {
	t.Helper()

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&count); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return count
}
