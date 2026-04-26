package application

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"nido/server/internal/ingestion/domain"
)

type ingestionStoreStub struct {
	getRunFn       func(ctx context.Context, runID string) (domain.Run, error)
	getSourceFn    func(ctx context.Context, sourceID string) (domain.Source, error)
	upsertSourceFn func(ctx context.Context, source domain.Source) error
}

func (s ingestionStoreStub) UpsertSource(ctx context.Context, source domain.Source) error {
	if s.upsertSourceFn != nil {
		return s.upsertSourceFn(ctx, source)
	}

	return nil
}

func (s ingestionStoreStub) ListSources(context.Context) ([]domain.Source, error) { return nil, nil }

func (s ingestionStoreStub) ListDueSources(context.Context, time.Time, int) ([]domain.Source, error) {
	return nil, nil
}

func (s ingestionStoreStub) GetSource(ctx context.Context, sourceID string) (domain.Source, error) {
	if s.getSourceFn != nil {
		return s.getSourceFn(ctx, sourceID)
	}

	return domain.Source{}, nil
}

func (s ingestionStoreStub) DeleteSource(context.Context, string) error { return nil }

func (s ingestionStoreStub) UpdateSourceRunState(context.Context, string, *time.Time, *time.Time) error {
	return nil
}

func (s ingestionStoreStub) CountRunsSince(context.Context, string, time.Time) (int, error) {
	return 0, nil
}

func (s ingestionStoreStub) TryAcquireIngestionLock(context.Context, string, string, time.Time, time.Time) (bool, error) {
	return false, nil
}

func (s ingestionStoreStub) ReleaseIngestionLock(context.Context, string, string) error { return nil }

func (s ingestionStoreStub) CreateRun(context.Context, domain.Run) error { return nil }

func (s ingestionStoreStub) CompleteRun(context.Context, string, time.Time, int, string, int, json.RawMessage) error {
	return nil
}

func (s ingestionStoreStub) FailRun(context.Context, string, time.Time, string, string, int, json.RawMessage) error {
	return nil
}

func (s ingestionStoreStub) ListRuns(context.Context, string, int) ([]domain.Run, error) {
	return nil, nil
}

func (s ingestionStoreStub) GetRun(ctx context.Context, runID string) (domain.Run, error) {
	if s.getRunFn != nil {
		return s.getRunFn(ctx, runID)
	}

	return domain.Run{}, nil
}

func (s ingestionStoreStub) RecordArtifact(context.Context, domain.Artifact) error { return nil }

func (s ingestionStoreStub) ReplaceObservedListings(context.Context, string, time.Time, []domain.CandidateListing) ([]domain.ListingChange, error) {
	return nil, nil
}

func TestServiceEnsureSourceNormalizesAndReturnsStoredShape(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	var stored domain.Source
	service, err := NewService(nil, ingestionStoreStub{
		upsertSourceFn: func(_ context.Context, source domain.Source) error {
			stored = source
			return nil
		},
	}, nil, []Connector{stubConnector{kind: "http-json-feed"}}, fixedClock{now: now}, 0, nil, nil)
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	source, err := service.EnsureSource(context.Background(), domain.Source{
		EndpointURL: "https://example.test/feed.json",
		ID:          "source-1",
		Kind:        "http-json-feed",
		Name:        "Source One",
	})
	if err != nil {
		t.Fatalf("ensure source: %v", err)
	}

	if source.ConfigJSON != "[]" {
		t.Fatalf("expected default config json, got %q", source.ConfigJSON)
	}
	if !source.CreatedAt.Equal(now) || !source.UpdatedAt.Equal(now) {
		t.Fatalf("expected timestamps to be normalized to %s, got created=%s updated=%s", now, source.CreatedAt, source.UpdatedAt)
	}
	if !reflect.DeepEqual(source, stored) {
		t.Fatalf("expected persisted source to match returned source\nwant: %#v\ngot:  %#v", source, stored)
	}
}

func TestServiceEnsureSourceRejectsInvalidJSONConfig(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	service, err := NewService(nil, ingestionStoreStub{}, nil, nil, fixedClock{now: now}, 0, nil, nil)
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	_, err = service.EnsureSource(context.Background(), domain.Source{
		ID:         "template-1",
		Name:       "Template One",
		ConfigJSON: `{`,
	})
	if err == nil || !strings.Contains(err.Error(), "valid json") {
		t.Fatalf("expected json validation error, got %v", err)
	}
}

func TestServiceGetSourceMapsStoreNotFound(t *testing.T) {
	t.Parallel()

	service := &Service{store: ingestionStoreStub{getSourceFn: func(context.Context, string) (domain.Source, error) {
		return domain.Source{}, sql.ErrNoRows
	}}}

	_, err := service.GetSource(context.Background(), "missing-source")
	if !errors.Is(err, ErrSourceNotFound) {
		t.Fatalf("expected source not found error, got %v", err)
	}
}

func TestServiceGetRunMapsStoreNotFound(t *testing.T) {
	t.Parallel()

	service := &Service{store: ingestionStoreStub{getRunFn: func(context.Context, string) (domain.Run, error) {
		return domain.Run{}, sql.ErrNoRows
	}}}

	_, err := service.GetRun(context.Background(), "missing-run")
	if !errors.Is(err, ErrRunNotFound) {
		t.Fatalf("expected run not found error, got %v", err)
	}
}

func TestServiceGetSourcePreservesUnexpectedErrors(t *testing.T) {
	t.Parallel()

	expectedErr := errors.New("store unavailable")
	service := &Service{store: ingestionStoreStub{getSourceFn: func(context.Context, string) (domain.Source, error) {
		return domain.Source{}, expectedErr
	}}}

	_, err := service.GetSource(context.Background(), "source-1")
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected original error, got %v", err)
	}
}

type fixedClock struct {
	now time.Time
}

func (c fixedClock) Now() time.Time {
	return c.now
}

type stubConnector struct {
	kind string
}

func (c stubConnector) Kind() string {
	return c.kind
}

func (stubConnector) Fetch(context.Context, domain.Source) (FetchResult, error) {
	return FetchResult{}, nil
}

func (stubConnector) Parse(context.Context, domain.Source, []byte) ([]domain.CandidateListing, error) {
	return nil, nil
}
