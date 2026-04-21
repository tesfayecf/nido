package application

import (
	"context"
	"database/sql"
	"errors"

	"home-searcher/server/internal/catalog/domain"
)

// ErrNotFound indicates that the requested listing does not exist.
var ErrNotFound = errors.New("listing not found")

// Repository defines the catalog read contract.
type Repository interface {
	ListListings(ctx context.Context, query domain.ListQuery) ([]domain.Listing, error)
	GetListing(ctx context.Context, listingID string) (domain.Listing, []domain.PriceEvent, error)
}

// Service orchestrates catalog read access.
type Service struct {
	repository Repository
}

// NewService builds a catalog read service.
func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

// List returns catalog listings for the supplied query.
func (s *Service) List(ctx context.Context, query domain.ListQuery) ([]domain.Listing, error) {
	if query.Limit <= 0 {
		query.Limit = 50
	}
	if query.Limit > 200 {
		query.Limit = 200
	}

	return s.repository.ListListings(ctx, query)
}

// Get returns one listing with its price history.
func (s *Service) Get(ctx context.Context, listingID string) (domain.ListingDetail, error) {
	listing, history, err := s.repository.GetListing(ctx, listingID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.ListingDetail{}, ErrNotFound
		}

		return domain.ListingDetail{}, err
	}

	return domain.ListingDetail{Listing: listing, PriceHistory: history}, nil
}
