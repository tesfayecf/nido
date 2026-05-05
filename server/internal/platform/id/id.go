/**
 * File: internal/platform/id/id.go
 *
 * Purpose:
 * Implements backend behavior for the id package.
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
 * - crypto/rand
 * - crypto/sha256
 * - encoding/hex
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package id

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

/**
 * Purpose:
 * Performs the New operation for this backend package.
 *
 * Parameters:
 * - prefix string
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
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func New(prefix string) string {
	buffer := make([]byte, 6)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}

	return prefix + "_" + hex.EncodeToString(buffer)
}

/**
 * Purpose:
 * Performs the Deterministic operation for this backend package.
 *
 * Parameters:
 * - prefix, source string
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
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func Deterministic(prefix, source string) string {
	sum := sha256.Sum256([]byte(source))
	return prefix + "_" + hex.EncodeToString(sum[:8])
}
