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

### Backoffice (Sources / Runs)

- `GET /api/v1/backoffice/sources`
- `POST /api/v1/backoffice/sources`
- `GET /api/v1/backoffice/sources/{sourceID}`
- `GET /api/v1/backoffice/runs`
- `GET /api/v1/backoffice/runs/{runID}`
- `POST /api/v1/backoffice/sources/{sourceID}/ingest`
- `GET /api/v1/backoffice/events`

### Backoffice (Properties — property-level tracking)

All property routes require authentication.

- `GET /api/v1/backoffice/properties` — list all tracked properties
- `POST /api/v1/backoffice/properties` — create a tracked property (`{url, label, schedule_interval_seconds?, retry_max_attempts?, retry_backoff_millis?}`)
- `GET /api/v1/backoffice/properties/{propertyID}` — get one property
- `PUT /api/v1/backoffice/properties/{propertyID}` — update label and scheduling fields
- `POST /api/v1/backoffice/properties/{propertyID}/config` — save an extraction config version (`{fields: FieldSelector[]}`)
- `GET /api/v1/backoffice/properties/{propertyID}/config` — get the latest extraction config
- `POST /api/v1/backoffice/properties/preview` — stateless extraction preview (`{url, fields}`) — no property ID needed
- `POST /api/v1/backoffice/properties/{propertyID}/preview` — preview using a saved property (body `{url, fields}`)
- `POST /api/v1/backoffice/properties/{propertyID}/ingest` — run a manual ingest for a property
- `GET /api/v1/backoffice/properties/{propertyID}/snapshots` — list snapshots (`?limit=N`)

#### FieldSelector shape

```json
{
  "name": "price",
  "selectors": [".price", ".price-value"],
  "attribute": "",
  "transform": "number",
  "required": true
}
```

#### PropertyPreviewResult shape

```json
{
  "values": { "price": "350000", "title": "3-bed apartment" },
  "failures": ["location: no matching element found"],
  "success": false
}
```

#### Property status values

`pending` | `active` | `degraded` | `inactive`

- `pending` — never ingested
- `active` — last ingest succeeded and all required fields extracted
- `degraded` — last ingest ran but required fields were missing or extraction partially failed
- `inactive` — manually deactivated

## Current Data Gaps

The frontend must document and respect the following backend limitations:

- Listings do not expose coordinates.
- Listings do not expose region hierarchies or category facets.
- Listing detail only returns the listing and price history.
- There are no public aggregate endpoints for comparisons or trend analytics.
- Source create and update are both handled through the same POST upsert route.
- Source `config_json` is a raw JSON string field, not a structured schema-driven object.
- The live event stream is authenticated and unidirectional.
- Property preview fetches the target URL directly from the backend (no browser rendering); JavaScript-heavy pages may return incomplete HTML.
- Property snapshots store extracted values as a JSON map of field name → string; numeric conversion happens via `transform: "number"` on the selector.
- Visual DOM selector (iframe-based click-to-select) is deferred to a later iteration; only manual CSS selector entry is implemented now.

## Frontend Consequences

- Map views stay behind a null adapter until backend geospatial data exists.
- Region and category comparisons stay deferred.
- Analytics should not be faked from incomplete data.
- Source editing in iteration 1 should use a raw JSON textarea for advanced config.
- The frontend must use an authenticated fetch-based SSE client instead of native `EventSource`.
- Property preview results use the stateless `/api/v1/backoffice/properties/preview` route so no property must exist before previewing.