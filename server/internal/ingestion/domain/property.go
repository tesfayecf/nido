package domain

import (
	"encoding/json"
	"time"
)

// PropertyStatus describes the health of a tracked property.
type PropertyStatus string

const (
	// PropertyStatusPending means the property has not yet been ingested.
	PropertyStatusPending PropertyStatus = "pending"
	// PropertyStatusActive means the last ingest succeeded for the property.
	PropertyStatusActive PropertyStatus = "active"
	// PropertyStatusDegraded means the last ingest ran but required fields were missing.
	PropertyStatusDegraded PropertyStatus = "degraded"
	// PropertyStatusInactive means the property is no longer being tracked.
	PropertyStatusInactive PropertyStatus = "inactive"
)

// FieldSelector describes how to extract one named field from a page.
type FieldSelector struct {
	Name      string   `json:"name"`
	Selectors []string `json:"selectors"`
	Attribute string   `json:"attribute,omitempty"`
	Transform string   `json:"transform,omitempty"`
	Required  bool     `json:"required"`
}

// PropertyExtractionConfig holds the user-defined extraction rules for a property.
type PropertyExtractionConfig struct {
	ID         string          `json:"id"`
	PropertyID string          `json:"property_id"`
	Fields     []FieldSelector `json:"fields"`
	Version    int             `json:"version"`
	CreatedAt  time.Time       `json:"created_at"`
}

// Property represents a single tracked real estate listing URL.
type Property struct {
	ID                      string         `json:"id"`
	URL                     string         `json:"url"`
	Label                   string         `json:"label"`
	Status                  PropertyStatus `json:"status"`
	ScheduleIntervalSeconds int            `json:"schedule_interval_seconds,omitempty"`
	RetryMaxAttempts        int            `json:"retry_max_attempts,omitempty"`
	RetryBackoffMillis      int            `json:"retry_backoff_millis,omitempty"`
	LastRunAt               *time.Time     `json:"last_run_at,omitempty"`
	NextRunAt               *time.Time     `json:"next_run_at,omitempty"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
}

// RetryAttempts returns the effective retry count for the property.
func (p Property) RetryAttempts() int {
	if p.RetryMaxAttempts <= 0 {
		return 1
	}

	return p.RetryMaxAttempts
}

// RetryBackoff returns the effective retry backoff duration.
func (p Property) RetryBackoff() time.Duration {
	if p.RetryBackoffMillis <= 0 {
		return 500 * time.Millisecond
	}

	return time.Duration(p.RetryBackoffMillis) * time.Millisecond
}

// ScheduleInterval returns the periodic scheduler cadence for the property.
func (p Property) ScheduleInterval() time.Duration {
	if p.ScheduleIntervalSeconds <= 0 {
		return 0
	}

	return time.Duration(p.ScheduleIntervalSeconds) * time.Second
}

// PropertySnapshot is one point-in-time extraction result for a property.
type PropertySnapshot struct {
	ID            string          `json:"id"`
	PropertyID    string          `json:"property_id"`
	ConfigVersion int             `json:"config_version"`
	ObservedAt    time.Time       `json:"observed_at"`
	Values        json.RawMessage `json:"values"`
	ChangeFlags   json.RawMessage `json:"change_flags,omitempty"`
	IsValid       bool            `json:"is_valid"`
	ErrorMessage  string          `json:"error_message,omitempty"`
}

// PropertyPreviewRequest is the input for a one-off extraction preview.
type PropertyPreviewRequest struct {
	URL    string          `json:"url"`
	Fields []FieldSelector `json:"fields"`
}

// PropertyPreviewResult is the output of a one-off extraction preview.
type PropertyPreviewResult struct {
	Values   map[string]string `json:"values"`
	Failures []string          `json:"failures,omitempty"`
	Success  bool              `json:"success"`
}
