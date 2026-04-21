package fetcher

import "time"

type domainTelemetry struct {
	requests  int64
	successes int64
}

type proxyTelemetry struct {
	requests int64
	total    time.Duration
}

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
