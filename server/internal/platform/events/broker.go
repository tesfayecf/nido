package events

import (
	"sync"
	"time"

	"home-searcher/server/internal/platform/id"
)

// Event is the serialized payload emitted through the in-process broker.
type Event struct {
	ID   string    `json:"id"`
	Type string    `json:"type"`
	Time time.Time `json:"time"`
	Data any       `json:"data"`
}

// Broker provides a lightweight pub/sub mechanism for live transport.
type Broker struct {
	mu          sync.RWMutex
	subscribers map[chan Event]struct{}
}

// NewBroker builds an empty event broker.
func NewBroker() *Broker {
	return &Broker{subscribers: make(map[chan Event]struct{})}
}

// Publish emits an event to all current subscribers.
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

// Subscribe registers a buffered channel and returns a cancellation function.
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