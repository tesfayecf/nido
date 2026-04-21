# Backend Contract Notes

## Current Supported Endpoints

### Auth

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

### Listings

- `GET /api/v1/listings`
- `GET /api/v1/listings/{listingID}`

Supported list filters today:

- `q`
- `source_id`
- `limit`

### Personal Tracking

- `GET /api/v1/me/bookmarks`
- `POST /api/v1/me/bookmarks`
- `DELETE /api/v1/me/bookmarks/{listingID}`
- `GET /api/v1/me/watchlists`
- `POST /api/v1/me/watchlists`
- `DELETE /api/v1/me/watchlists/{watchlistID}`
- `GET /api/v1/me/alert-rules`
- `POST /api/v1/me/alert-rules`
- `DELETE /api/v1/me/alert-rules/{ruleID}`
- `GET /api/v1/me/notifications`
- `POST /api/v1/me/notifications/{notificationID}/read`

### Backoffice

- `GET /api/v1/backoffice/sources`
- `POST /api/v1/backoffice/sources`
- `GET /api/v1/backoffice/sources/{sourceID}`
- `GET /api/v1/backoffice/runs`
- `GET /api/v1/backoffice/runs/{runID}`
- `POST /api/v1/backoffice/sources/{sourceID}/ingest`
- `GET /api/v1/backoffice/events`

## Current Data Gaps

The frontend must document and respect the following backend limitations:

- Listings do not expose coordinates.
- Listings do not expose region hierarchies or category facets.
- Listing detail only returns the listing and price history.
- There are no public aggregate endpoints for comparisons or trend analytics.
- Source create and update are both handled through the same POST upsert route.
- Source `config_json` is a raw JSON string field, not a structured schema-driven object.
- The live event stream is authenticated and unidirectional.

## Frontend Consequences

- Map views stay behind a null adapter until backend geospatial data exists.
- Region and category comparisons stay deferred.
- Analytics should not be faked from incomplete data.
- Source editing in iteration 1 should use a raw JSON textarea for advanced config.
- The frontend must use an authenticated fetch-based SSE client instead of native `EventSource`.