package engine

import (
	"context"
	"net/http"

	"home-searcher/server/internal/fetcher"
	"home-searcher/server/internal/ingestion/domain"
)

// Fetcher retrieves raw source payloads.
type Fetcher interface {
	Fetch(ctx context.Context, endpointURL string, headers http.Header) (fetcher.Result, error)
}

// Parser converts raw payloads into candidate listings.
type Parser interface {
	Parse(source domain.Source, payload []byte) ([]domain.CandidateListing, error)
}

// Repository persists normalized candidate listings.
type Repository interface {
	ReplaceObservedListings(ctx context.Context, sourceID string, observedAt fetcher.Result, candidates []domain.CandidateListing) error
}

// Runner wires fetching and parsing into a single ingestable unit.
type Runner struct {
	fetcher Fetcher
	parser  Parser
}

// NewRunner builds a modular ingestion runner.
func NewRunner(fetcher Fetcher, parser Parser) Runner {
	return Runner{fetcher: fetcher, parser: parser}
}

// Run fetches and parses one source payload.
func (r Runner) Run(ctx context.Context, source domain.Source) (fetcher.Result, []domain.CandidateListing, error) {
	result, err := r.fetcher.Fetch(ctx, source.EndpointURL, nil)
	if err != nil {
		return fetcher.Result{}, nil, err
	}

	candidates, err := r.parser.Parse(source, result.Payload)
	if err != nil {
		return fetcher.Result{}, nil, err
	}

	return result, candidates, nil
}
