/**
 * File: internal/platform/httpapi/sse.go
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
 * - encoding/json
 * - fmt
 * - net/http
 * - time
 * - nido/server/internal/platform/events
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	platformevents "nido/server/internal/platform/events"
)

/**
 * Purpose:
 * Performs the StreamSSE operation for this backend package.
 *
 * Parameters:
 * - w http.ResponseWriter, r *http.Request, events <-chan platformevents.Event
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
func StreamSSE(w http.ResponseWriter, r *http.Request, events <-chan platformevents.Event) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming is not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	keepAlive := time.NewTicker(15 * time.Second)
	defer keepAlive.Stop()

	_, _ = fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepAlive.C:
			_, _ = fmt.Fprint(w, ": keepalive\n\n")
			flusher.Flush()
		case event, ok := <-events:
			if !ok {
				return
			}

			payload, err := json.Marshal(event.Data)
			if err != nil {
				continue
			}

			_, _ = fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\n\n", event.ID, event.Type, payload)
			flusher.Flush()
		}
	}
}
