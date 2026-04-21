package domain

import (
	"encoding/json"
	"time"
)

// RunStatus describes the current state of an ingestion run.
type RunStatus string

const (
	// RunStatusRunning marks a run that is still executing.
	RunStatusRunning RunStatus = "running"
	// RunStatusCompleted marks a run that finished successfully.
	RunStatusCompleted RunStatus = "completed"
	// RunStatusFailed marks a run that finished with an error.
	RunStatusFailed RunStatus = "failed"
)

const (
	// TriggerKindManual indicates a user-triggered ingest.
	TriggerKindManual = "manual"
	// TriggerKindScheduled indicates a scheduler-triggered ingest.
	TriggerKindScheduled = "scheduled"
)

// Run tracks a single ingestion execution.
type Run struct {
	ID                 string          `json:"id"`
	SourceID           string          `json:"source_id"`
	CorrelationID      string          `json:"correlation_id"`
	TriggerKind        string          `json:"trigger_kind"`
	Status             RunStatus       `json:"status"`
	StartedAt          time.Time       `json:"started_at"`
	FinishedAt         *time.Time      `json:"finished_at,omitempty"`
	AttemptCount       int             `json:"attempt_count"`
	ItemCount          int             `json:"item_count"`
	ArtifactKey        string          `json:"artifact_key,omitempty"`
	FailureArtifactKey string          `json:"failure_artifact_key,omitempty"`
	Diagnostics        json.RawMessage `json:"diagnostics,omitempty"`
	ErrorMessage       string          `json:"error_message,omitempty"`
}

// CandidateListing is the normalized listing shape produced by a source parser.
type CandidateListing struct {
	ExternalID  string
	Title       string
	PriceAmount int64
	Currency    string
	Location    string
	URL         string
}

// Artifact captures the metadata stored for a raw source payload.
type Artifact struct {
	Key         string
	SourceID    string
	RunID       string
	Kind        string
	ContentType string
	Checksum    string
	ByteSize    int64
	CreatedAt   time.Time
}

// ListingChange captures user-visible changes detected during reconciliation.
type ListingChange struct {
	ListingID      string
	SourceID       string
	Title          string
	PriceAmount    int64
	Currency       string
	Location       string
	URL            string
	IsNew          bool
	PriceChanged   bool
	PreviousAmount *int64
}
