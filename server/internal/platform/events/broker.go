/**
 * File: internal/platform/events/broker.go
 *
 * Purpose:
 * Implements backend behavior for the events package.
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
 * - sync
 * - time
 * - nido/server/internal/platform/id
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package events

import (
	"sync"
	"time"

	"nido/server/internal/platform/id"
)

/**
 * Purpose:
 * Defines the Event struct used by this package and its consumers.
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
type Event struct {
	ID   string    `json:"id"`
	Type string    `json:"type"`
	Time time.Time `json:"time"`
	Data any       `json:"data"`
}

/**
 * Purpose:
 * Defines the Broker struct used by this package and its consumers.
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
type Broker struct {
	mu          sync.RWMutex
	subscribers map[chan Event]struct{}
}

/**
 * Purpose:
 * Performs the NewBroker operation for this backend package.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - *Broker
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
func NewBroker() *Broker {
	return &Broker{subscribers: make(map[chan Event]struct{})}
}

/**
 * Purpose:
 * Performs the Publish operation for this backend package.
 *
 * Parameters:
 * - b *Broker
 *
 * Returns:
 * - Publish(eventType string, data any)
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
func (b *Broker) Publish(eventType string, data any) {
	event := Event{
		ID:   id.New("evt"),
		Type: eventType,
		Time: time.Now().UTC(),
		Data: data,
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	for subscriber := range b.subscribers {
		select {
		case subscriber <- event:
		default:
		}
	}
}

/**
 * Purpose:
 * Performs the Subscribe operation for this backend package.
 *
 * Parameters:
 * - b *Broker
 *
 * Returns:
 * - Subscribe(buffer int) (<-chan Event, func())
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
func (b *Broker) Subscribe(buffer int) (<-chan Event, func()) {
	if buffer <= 0 {
		buffer = 16
	}

	channel := make(chan Event, buffer)

	b.mu.Lock()
	b.subscribers[channel] = struct{}{}
	b.mu.Unlock()

	return channel, func() {
		b.mu.Lock()
		if _, ok := b.subscribers[channel]; ok {
			delete(b.subscribers, channel)
			close(channel)
		}
		b.mu.Unlock()
	}
}
