package fetcher

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

// Client fetches remote source payloads.
type Client interface {
	Fetch(ctx context.Context, request Request) (Response, error)
}

// Config controls shared HTTP fetching behavior.
type Config struct {
	Logger          *slog.Logger
	HTTPClient      *http.Client
	Timeout         time.Duration
	ProxyProvider   string
	TLSProfile      string
	BreakerInterval time.Duration
	BreakerTimeout  time.Duration
	Profiles        []SessionProfile
}

// Request captures one outbound fetch operation.
type Request struct {
	URL                string
	Accept             string
	DefaultContentType string
	BrowserEnabled     bool
	SessionKey         string
}

// Response contains the fetched payload and transport metadata.
type Response struct {
	Payload        []byte
	ContentType    string
	FetchedAt      time.Time
	BytesProcessed int
	Domain         string
	ProxyProvider  string
	Latency        time.Duration
}
