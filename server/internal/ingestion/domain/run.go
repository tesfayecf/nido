/**
 * File: internal/ingestion/domain/run.go
 *
 * Purpose:
 * Defines domain data structures and normalization rules for this backend area.
 *
 * Responsibilities:
 * - Define data contracts
 * - Normalize values used across layers
 * - Keep business terminology centralized
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - encoding/json
 * - time
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package domain

import (
	"encoding/json"
	"time"
)

/**
 * Purpose:
 * Defines the RunStatus type alias or composite type used by this package and its consumers.
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

/**
 * Purpose:
 * Defines the Run struct used by this package and its consumers.
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

/**
 * Purpose:
 * Defines the CandidateListing struct used by this package and its consumers.
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
type CandidateListing struct {
	ExternalID  string
	Title       string
	PriceAmount int64
	Currency    string
	Location    string
	URL         string
}

/**
 * Purpose:
 * Defines the Artifact struct used by this package and its consumers.
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

/**
 * Purpose:
 * Defines the ListingChange struct used by this package and its consumers.
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
