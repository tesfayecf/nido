/**
 * File: internal/fetcher/session.go
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
 * - hash/fnv
 * - strings
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package fetcher

import (
	"hash/fnv"
	"strings"
)

/**
 * Purpose:
 * Defines the SessionProfile struct used by this package and its consumers.
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
type SessionProfile struct {
	UserAgent               string
	SecCHUA                 string
	SecCHUAPlatform         string
	Accept                  string
	AcceptLanguage          string
	SecFetchDest            string
	SecFetchMode            string
	SecFetchSite            string
	UpgradeInsecureRequests string
}

/**
 * Purpose:
 * Performs the defaultProfiles operation for this backend package.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - []SessionProfile
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
func defaultProfiles() []SessionProfile {
	return []SessionProfile{
		{
			UserAgent:               "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
			SecCHUA:                 `"Chromium";v="135", "Google Chrome";v="135", "Not.A/Brand";v="24"`,
			SecCHUAPlatform:         `"Windows"`,
			Accept:                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
			AcceptLanguage:          "en-US,en;q=0.9",
			SecFetchDest:            "document",
			SecFetchMode:            "navigate",
			SecFetchSite:            "none",
			UpgradeInsecureRequests: "1",
		},
		{
			UserAgent:               "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
			Accept:                  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			AcceptLanguage:          "en-US,en;q=0.8",
			SecFetchDest:            "document",
			SecFetchMode:            "navigate",
			SecFetchSite:            "none",
			UpgradeInsecureRequests: "1",
		},
		{
			UserAgent:               "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
			Accept:                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			AcceptLanguage:          "en-US,en;q=0.7",
			SecFetchDest:            "document",
			SecFetchMode:            "navigate",
			SecFetchSite:            "none",
			UpgradeInsecureRequests: "1",
		},
	}
}

/**
 * Purpose:
 * Performs the profileFor operation for this backend package.
 *
 * Parameters:
 * - profiles []SessionProfile, sessionKey string
 *
 * Returns:
 * - SessionProfile
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
func profileFor(profiles []SessionProfile, sessionKey string) SessionProfile {
	resolved := profiles
	if len(resolved) == 0 {
		resolved = defaultProfiles()
	}

	key := strings.TrimSpace(sessionKey)
	if key == "" {
		return resolved[0]
	}

	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(key))
	return resolved[int(hasher.Sum32())%len(resolved)]
}
