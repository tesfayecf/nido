/**
 * File: internal/ingestion/domain/source.go
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
 * - time
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package domain

import "time"

/**
 * Purpose:
 * Defines the Source struct used by this package and its consumers.
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

/**
 * Purpose:
 * Performs the RateLimitWindow operation for this backend package.
 *
 * Parameters:
 * - s Source
 *
 * Returns:
 * - RateLimitWindow() time.Duration
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (s Source) RateLimitWindow() time.Duration {
	if s.RateLimitWindowSeconds <= 0 {
		return 0
	}

	return time.Duration(s.RateLimitWindowSeconds) * time.Second
}

/**
 * Purpose:
 * Performs the RetryAttempts operation for this backend package.
 *
 * Parameters:
 * - s Source
 *
 * Returns:
 * - RetryAttempts() int
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (s Source) RetryAttempts() int {
	if s.RetryMaxAttempts <= 0 {
		return 1
	}

	return s.RetryMaxAttempts
}

/**
 * Purpose:
 * Performs the RetryBackoff operation for this backend package.
 *
 * Parameters:
 * - s Source
 *
 * Returns:
 * - RetryBackoff() time.Duration
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (s Source) RetryBackoff() time.Duration {
	if s.RetryBackoffMillis <= 0 {
		return 500 * time.Millisecond
	}

	return time.Duration(s.RetryBackoffMillis) * time.Millisecond
}

/**
 * Purpose:
 * Performs the ScheduleInterval operation for this backend package.
 *
 * Parameters:
 * - s Source
 *
 * Returns:
 * - ScheduleInterval() time.Duration
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (s Source) ScheduleInterval() time.Duration {
	if s.ScheduleIntervalSeconds <= 0 {
		return 0
	}

	return time.Duration(s.ScheduleIntervalSeconds) * time.Second
}

/**
 * Purpose:
 * Performs the FreshnessWindow operation for this backend package.
 *
 * Parameters:
 * - s Source
 *
 * Returns:
 * - FreshnessWindow() time.Duration
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (s Source) FreshnessWindow() time.Duration {
	if s.FreshnessWindowSeconds <= 0 {
		return 0
	}

	return time.Duration(s.FreshnessWindowSeconds) * time.Second
}
