/**
 * File: internal/fetcher/challenge.go
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
 * - fmt
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
	"fmt"
	"strings"
)

const challengeScanLimit = 16 * 1024

var antiBotChallengeMarkers = []string{
	"pardon our interruption",
	"just a moment",
	"attention required",
	"verify you are human",
	"security check",
	"captcha",
	"cloudflare ray id",
	"cf-browser-verification",
	"ddos-guard",
	"automated access",
	"access denied",
}

/**
 * Purpose:
 * Defines the antiBotChallengeError struct used by this package and its consumers.
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
type antiBotChallengeError struct {
	marker string
	via    string
}

/**
 * Purpose:
 * Performs the Error operation for this backend package.
 *
 * Parameters:
 * - e *antiBotChallengeError
 *
 * Returns:
 * - Error() string
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
func (e *antiBotChallengeError) Error() string {
	if e == nil {
		return "portal returned an anti-bot challenge page"
	}
	if e.marker == "" {
		return fmt.Sprintf("portal returned an anti-bot challenge page via %s", e.via)
	}

	return fmt.Sprintf("portal returned an anti-bot challenge page via %s (matched %q)", e.via, e.marker)
}

/**
 * Purpose:
 * Performs the detectAntiBotChallenge operation for this backend package.
 *
 * Parameters:
 * - body []byte
 *
 * Returns:
 * - string
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
func detectAntiBotChallenge(body []byte) string {
	if len(body) == 0 {
		return ""
	}

	scanned := body
	if len(scanned) > challengeScanLimit {
		scanned = scanned[:challengeScanLimit]
	}
	lowered := strings.ToLower(string(scanned))
	for _, marker := range antiBotChallengeMarkers {
		if strings.Contains(lowered, marker) {
			return marker
		}
	}

	return ""
}
