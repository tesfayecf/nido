/**
 * File: internal/platformops/domain/models.go
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
 * Defines the IntegrationChannelConfig struct used by this package and its consumers.
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
type IntegrationChannelConfig struct {
	URL    string   `json:"url,omitempty"`
	Events []string `json:"events,omitempty"`
}

/**
 * Purpose:
 * Defines the EmailDigestConfig struct used by this package and its consumers.
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
type EmailDigestConfig struct {
	Enabled    bool       `json:"enabled"`
	Recipient  string     `json:"recipient,omitempty"`
	Schedule   string     `json:"schedule,omitempty"`
	Events     []string   `json:"events,omitempty"`
	LastSentAt *time.Time `json:"last_sent_at,omitempty"`
}

/**
 * Purpose:
 * Defines the PlatformSettings struct used by this package and its consumers.
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
type PlatformSettings struct {
	ID                       string                   `json:"id"`
	SchedulerEnabled         bool                     `json:"scheduler_enabled"`
	MaintenanceWindowEnabled bool                     `json:"maintenance_window_enabled"`
	MaintenanceWindowStart   string                   `json:"maintenance_window_start,omitempty"`
	MaintenanceWindowEnd     string                   `json:"maintenance_window_end,omitempty"`
	Webhook                  IntegrationChannelConfig `json:"webhook"`
	Slack                    IntegrationChannelConfig `json:"slack"`
	Spreadsheet              IntegrationChannelConfig `json:"spreadsheet"`
	TaskSystem               IntegrationChannelConfig `json:"task_system"`
	EmailDigest              EmailDigestConfig        `json:"email_digest"`
	UpdatedAt                time.Time                `json:"updated_at"`
}

/**
 * Purpose:
 * Defines the IntegrationDeliveryLog struct used by this package and its consumers.
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
type IntegrationDeliveryLog struct {
	ID             string          `json:"id"`
	Channel        string          `json:"channel"`
	EventType      string          `json:"event_type"`
	Target         string          `json:"target,omitempty"`
	Status         string          `json:"status"`
	AttemptCount   int             `json:"attempt_count"`
	Payload        json.RawMessage `json:"payload,omitempty"`
	ResponseStatus int             `json:"response_status,omitempty"`
	ErrorMessage   string          `json:"error_message,omitempty"`
	DeliveredAt    *time.Time      `json:"delivered_at,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

/**
 * Purpose:
 * Defines the SchedulerSummary struct used by this package and its consumers.
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
type SchedulerSummary struct {
	SchedulerEnabled         bool      `json:"scheduler_enabled"`
	MaintenanceWindowActive  bool      `json:"maintenance_window_active"`
	MaintenanceWindowEnabled bool      `json:"maintenance_window_enabled"`
	RunningProperties        int       `json:"running_properties"`
	DueProperties            int       `json:"due_properties"`
	TrackedProperties        int       `json:"tracked_properties"`
	PausedProperties         int       `json:"paused_properties"`
	QueueDepth               int       `json:"queue_depth"`
	RunsLast24Hours          int       `json:"runs_last_24_hours"`
	FailuresLast24Hours      int       `json:"failures_last_24_hours"`
	SuccessRate              float64   `json:"success_rate"`
	LastUpdatedAt            time.Time `json:"last_updated_at"`
}
