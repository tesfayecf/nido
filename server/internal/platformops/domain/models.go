package domain

import (
	"encoding/json"
	"time"
)

// IntegrationChannelConfig stores delivery settings for one outbound channel.
type IntegrationChannelConfig struct {
	URL    string   `json:"url,omitempty"`
	Events []string `json:"events,omitempty"`
}

// EmailDigestConfig stores single-user email digest settings.
type EmailDigestConfig struct {
	Enabled    bool       `json:"enabled"`
	Recipient  string     `json:"recipient,omitempty"`
	Schedule   string     `json:"schedule,omitempty"`
	Events     []string   `json:"events,omitempty"`
	LastSentAt *time.Time `json:"last_sent_at,omitempty"`
}

// PlatformSettings stores operational settings for the single-user workspace.
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

// IntegrationDeliveryLog records one integration delivery attempt.
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

// SchedulerSummary captures runtime operational visibility.
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
