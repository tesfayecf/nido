/**
 * File: internal/platform/httpapi/cors.go
 *
 * Purpose:
 * Implements backend behavior for the httpapi package.
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
 * - net
 * - net/http
 * - net/url
 * - strings
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package httpapi

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

const defaultCORSAllowHeaders = "Authorization, Content-Type"
const defaultCORSAllowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

/**
 * Purpose:
 * Performs the CORSMiddleware operation for this backend package.
 *
 * Parameters:
 * - next http.Handler
 *
 * Returns:
 * - http.Handler
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
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		header := w.Header()
		appendVary(header, "Origin")
		appendVary(header, "Access-Control-Request-Method")
		appendVary(header, "Access-Control-Request-Headers")

		if !isLoopbackOrigin(origin) {
			next.ServeHTTP(w, r)
			return
		}

		header.Set("Access-Control-Allow-Origin", origin)
		header.Set("Access-Control-Allow-Methods", defaultCORSAllowMethods)
		header.Set("Access-Control-Allow-Headers", requestedCORSHeaders(r))
		header.Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

/**
 * Purpose:
 * Performs the requestedCORSHeaders operation for this backend package.
 *
 * Parameters:
 * - r *http.Request
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
func requestedCORSHeaders(r *http.Request) string {
	requested := strings.TrimSpace(r.Header.Get("Access-Control-Request-Headers"))
	if requested == "" {
		return defaultCORSAllowHeaders
	}

	return requested
}

/**
 * Purpose:
 * Performs the isLoopbackOrigin operation for this backend package.
 *
 * Parameters:
 * - origin string
 *
 * Returns:
 * - bool
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
func isLoopbackOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}

	host := parsed.Hostname()
	if host == "" {
		return false
	}

	if strings.EqualFold(host, "localhost") {
		return true
	}

	parsedIP := net.ParseIP(host)
	return parsedIP != nil && parsedIP.IsLoopback()
}

/**
 * Purpose:
 * Performs the appendVary operation for this backend package.
 *
 * Parameters:
 * - header http.Header, value string
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
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func appendVary(header http.Header, value string) {
	for _, existing := range header.Values("Vary") {
		for _, item := range strings.Split(existing, ",") {
			if strings.EqualFold(strings.TrimSpace(item), value) {
				return
			}
		}
	}

	header.Add("Vary", value)
}
