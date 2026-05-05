/**
 * File: internal/fetcher/challenge_test.go
 *
 * Purpose:
 * Validates the fetcher package behavior covered by challenge_test.go.
 *
 * Responsibilities:
 * - Set up deterministic test fixtures
 * - Exercise expected success and failure paths
 * - Protect backend behavior from regressions
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - testing
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package fetcher

import "testing"

/**
 * Purpose:
 * Performs the TestDetectAntiBotChallengeRecognizesCommonChallengePages operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestDetectAntiBotChallengeRecognizesCommonChallengePages(t *testing.T) {
	t.Parallel()

	body := []byte(`<html><head><title>Just a moment...</title></head><body><div>Cloudflare Ray ID: abc123</div></body></html>`)
	if marker := detectAntiBotChallenge(body); marker == "" {
		t.Fatal("expected challenge marker to be detected")
	}
}

/**
 * Purpose:
 * Performs the TestDetectAntiBotChallengeIgnoresNormalListingPages operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
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
func TestDetectAntiBotChallengeIgnoresNormalListingPages(t *testing.T) {
	t.Parallel()

	body := []byte(`<html><head><title>Sunny flat in Girona</title></head><body><span class="price">198.000 €</span></body></html>`)
	if marker := detectAntiBotChallenge(body); marker != "" {
		t.Fatalf("expected normal page to pass, got marker %q", marker)
	}
}
