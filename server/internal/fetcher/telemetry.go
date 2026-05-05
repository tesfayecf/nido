/**
 * File: internal/fetcher/telemetry.go
 *
 * Purpose:
 * Provides outbound HTTP fetching, anti-bot handling, and fetch telemetry support.
 *
 * Responsibilities:
 * - Provide package-specific backend behavior
 * - Keep dependencies explicit
 * - Return deterministic values to callers
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
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package fetcher

import "time"

/**
 * Purpose:
 * Defines the domainTelemetry struct used by this package and its consumers.
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
type domainTelemetry struct {
	requests  int64
	successes int64
}

/**
 * Purpose:
 * Defines the proxyTelemetry struct used by this package and its consumers.
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
type proxyTelemetry struct {
	requests int64
	total    time.Duration
}

/**
 * Purpose:
 * Performs the recordTelemetry operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - recordTelemetry(domain, proxyProvider string, latency time.Duration, bytesProcessed int, success bool)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (c *HTTPClient) recordTelemetry(domain, proxyProvider string, latency time.Duration, bytesProcessed int, success bool) {
	c.metricsMu.Lock()
	defer c.metricsMu.Unlock()

	if domain != "" {
		metric := c.domainMetrics[domain]
		if metric == nil {
			metric = &domainTelemetry{}
			c.domainMetrics[domain] = metric
		}
		metric.requests++
		if success {
			metric.successes++
		}
	}

	if proxyProvider != "" {
		metric := c.proxyMetrics[proxyProvider]
		if metric == nil {
			metric = &proxyTelemetry{}
			c.proxyMetrics[proxyProvider] = metric
		}
		metric.requests++
		metric.total += latency
		if c.logger != nil {
			successRate := 0.0
			if domainMetric := c.domainMetrics[domain]; domainMetric != nil && domainMetric.requests > 0 {
				successRate = float64(domainMetric.successes) / float64(domainMetric.requests)
			}
			avgLatency := time.Duration(0)
			if metric.requests > 0 {
				avgLatency = time.Duration(int64(metric.total) / metric.requests)
			}
			c.logger.Info("fetch completed",
				"domain", domain,
				"proxy_provider", proxyProvider,
				"success_rate", successRate,
				"avg_latency", avgLatency,
				"bytes_processed", bytesProcessed,
			)
		}
	}
}
