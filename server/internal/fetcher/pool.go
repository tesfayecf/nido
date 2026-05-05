/**
 * File: internal/fetcher/pool.go
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
 * - bytes
 * - io
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package fetcher

import (
	"bytes"
	"io"
)

/**
 * Purpose:
 * Performs the readPayload operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - readPayload(reader io.Reader) ([]byte, int, error)
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
func (c *HTTPClient) readPayload(reader io.Reader) ([]byte, int, error) {
	buffer := c.acquireBuffer()
	defer c.releaseBuffer(buffer)

	if _, err := buffer.ReadFrom(reader); err != nil {
		return nil, 0, err
	}

	payload := append([]byte(nil), buffer.Bytes()...)
	return payload, len(payload), nil
}

/**
 * Purpose:
 * Performs the acquireBuffer operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - acquireBuffer() *bytes.Buffer
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
func (c *HTTPClient) acquireBuffer() *bytes.Buffer {
	buffer := c.buffers.Get().(*bytes.Buffer)
	buffer.Reset()
	return buffer
}

/**
 * Purpose:
 * Performs the releaseBuffer operation for this backend package.
 *
 * Parameters:
 * - c *HTTPClient
 *
 * Returns:
 * - releaseBuffer(buffer *bytes.Buffer)
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
func (c *HTTPClient) releaseBuffer(buffer *bytes.Buffer) {
	if buffer == nil {
		return
	}

	buffer.Reset()
	c.buffers.Put(buffer)
}
