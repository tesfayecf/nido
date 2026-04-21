package domain

import "time"

// Source describes an ingestible upstream source.
type Source struct {
	ID                      string     `json:"id"`
	Name                    string     `json:"name"`
	Kind                    string     `json:"kind"`
	EndpointURL             string     `json:"endpoint_url"`
	ConfigJSON              string     `json:"config_json,omitempty"`
	BrowserEnabled          bool       `json:"browser_enabled"`
	Active                  bool       `json:"active"`
	RateLimitWindowSeconds  int        `json:"rate_limit_window_seconds,omitempty"`
	RateLimitMaxRequests    int        `json:"rate_limit_max_requests,omitempty"`
	RetryMaxAttempts        int        `json:"retry_max_attempts,omitempty"`
	RetryBackoffMillis      int        `json:"retry_backoff_millis,omitempty"`
	ScheduleIntervalSeconds int        `json:"schedule_interval_seconds,omitempty"`
	FreshnessWindowSeconds  int        `json:"freshness_window_seconds,omitempty"`
	NextRunAt               *time.Time `json:"next_run_at,omitempty"`
	LastRunAt               *time.Time `json:"last_run_at,omitempty"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
}

// RateLimitWindow returns the configured rate-limit duration.
func (s Source) RateLimitWindow() time.Duration {
	if s.RateLimitWindowSeconds <= 0 {
		return 0
	}

	return time.Duration(s.RateLimitWindowSeconds) * time.Second
}

// RetryAttempts returns the effective retry count for the source.
func (s Source) RetryAttempts() int {
	if s.RetryMaxAttempts <= 0 {
		return 1
	}

	return s.RetryMaxAttempts
}

// RetryBackoff returns the effective retry backoff.
func (s Source) RetryBackoff() time.Duration {
	if s.RetryBackoffMillis <= 0 {
		return 500 * time.Millisecond
	}

	return time.Duration(s.RetryBackoffMillis) * time.Millisecond
}

// ScheduleInterval returns the periodic scheduler cadence for the source.
func (s Source) ScheduleInterval() time.Duration {
	if s.ScheduleIntervalSeconds <= 0 {
		return 0
	}

	return time.Duration(s.ScheduleIntervalSeconds) * time.Second
}

// FreshnessWindow returns the minimum freshness guarantee for the source.
func (s Source) FreshnessWindow() time.Duration {
	if s.FreshnessWindowSeconds <= 0 {
		return 0
	}

	return time.Duration(s.FreshnessWindowSeconds) * time.Second
}
