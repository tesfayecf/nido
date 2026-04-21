# Frontend Architecture

## Intent

The frontend under `/app` is a thin, typed React client over the backend APIs already implemented under `/server`. The goal is not to duplicate backend logic in the browser. The goal is to provide a dense, reliable working surface for market exploration, personal tracking, and operational ingestion control.

For startup and verification commands, see [app/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/app/docs/local-development.md).

This frontend intentionally separates server state from client state:

- TanStack Query owns remote reads, mutations, invalidation, and refetch policy.
- Zustand owns durable client concerns such as the bearer token snapshot, shell layout state, and the in-memory live-event stream.
- React Router owns navigation, route boundaries, and URL-backed search/filter state.

## Module Layout

### `app`

Owns runtime composition.

- Query client and providers
- Router composition
- Global shell layout
- Route guards and error boundaries

### `services`

Owns the typed backend contract per capability.

- `auth`
- `listings`
- `bookmarks`
- `watchlists`
- `alert-rules`
- `notifications`
- `backoffice-sources`
- `backoffice-runs`
- `backoffice-events`

Each service module owns wire DTOs, query key factories, and API functions. The frontend keeps the backend JSON shape instead of inventing a second client-side data vocabulary.

### `features`

Owns the actual user-facing workflows.

- `auth`: login and logout flow
- `listings`: explorer, detail, price history, bookmark action
- `engagement`: bookmarks, watchlists, alert rules, notifications
- `backoffice`: sources, runs, manual ingest, live events
- `map`: adapter boundary only in iteration 1

### `lib`

Owns small reusable technical primitives.

- API client and error parsing
- Authenticated SSE client
- Formatters for money and timestamps
- URL search-param helpers

### `stores`

Owns client state only.

- Session token and expiry
- Shell UI preferences
- Recent live events

### `components`

Owns reusable visual primitives.

- Dense cards, panels, buttons, fields
- App navigation and shell chrome
- Empty, loading, and error states

## Runtime Boundaries

### Public capabilities in iteration 1

- Listing search
- Listing detail
- Price history view

### Authenticated capabilities in iteration 1

- Bookmarks
- Watchlists
- Alert rules
- Notifications
- Backoffice source and run visibility
- Manual ingest
- Live ingest event stream

### Explicitly deferred capabilities

- True map exploration with markers and area selection
- Region and category comparison views
- Trend dashboards and anomaly analytics

These features remain deferred because the current backend listing contract does not include coordinates, category taxonomy, region aggregation, or dedicated analytics endpoints.

## Data Strategy

TanStack Query is the system of record for all backend reads and writes because it directly solves the cache invalidation, background refresh, deduplication, retry, and stale-data concerns of server state.

Zustand is intentionally constrained to:

- Auth token snapshot and expiry
- Shell layout state
- Live event rail state and latest event items

Filters that should survive refresh or deep-linking live in the URL, not in Zustand.

## Live Transport Strategy

The backend exposes a bearer-protected SSE stream at `/api/v1/backoffice/events`. Native `EventSource` cannot attach an `Authorization` header, so the frontend uses an authenticated fetch-based SSE client. The stream remains unidirectional and backoffice-scoped in iteration 1.

The routed shell now includes a route-level error boundary so unexpected render or loader failures degrade into a stable recovery screen instead of a blank application state.

## Styling Strategy

UI work is intentionally functional-first, but not throwaway. The app uses a small CSS token layer for color, spacing, typography, radius, and status states. The first iteration favors high information density, calm spacing, and clear visual hierarchy over decorative complexity.