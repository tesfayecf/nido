package domain

import "time"

// ListQuery contains the supported filters for listing reads.
type ListQuery struct {
	Query    string
	SourceID string
	Limit    int
}

// Listing is the canonical listing read model exposed to the frontend.
type Listing struct {
	ID               string    `json:"id"`
	SourceID         string    `json:"source_id"`
	ExternalID       string    `json:"external_id"`
	Title            string    `json:"title"`
	PriceAmount      int64     `json:"price_amount"`
	Currency         string    `json:"currency"`
	Location         string    `json:"location"`
	URL              string    `json:"url"`
	FirstSeenAt      time.Time `json:"first_seen_at"`
	LastSeenAt       time.Time `json:"last_seen_at"`
	LatestSnapshotAt time.Time `json:"latest_snapshot_at"`
}

// PriceEvent captures a persisted price change for a listing.
type PriceEvent struct {
	ID             string    `json:"id"`
	ListingID      string    `json:"listing_id"`
	PreviousAmount *int64    `json:"previous_amount,omitempty"`
	NewAmount      int64     `json:"new_amount"`
	ChangedAt      time.Time `json:"changed_at"`
}

// ListingDetail combines the listing read model and its price history.
type ListingDetail struct {
	Listing      Listing
	PriceHistory []PriceEvent
}
