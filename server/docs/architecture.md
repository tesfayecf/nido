# Backend Architecture

## Intent

The backend is implemented as a modular monolith under `/server`. The code is organized around bounded contexts instead of technical layers alone, so the runtime stays simple while the modules remain decouplable.

This first implementation slice keeps the system operational without overcommitting to features that still need product validation.

## Module Map

### `auth`

Owns bootstrap identity creation and bearer-session lifecycle.

- Bootstrap admin provisioning
- Password-based login
- Session validation and logout

### `engagement`

Owns user-specific tracking workflows and notification generation.

- Bookmarks
- Watchlists
- Alert rules
- Notification persistence and delivery hooks

### `catalog`

Owns the canonical listing view that the frontend consumes.

- Listing read models
- Listing detail
- Price history
- Search and filtering

### `ingestion`

Owns source definitions, fetch and parse orchestration, and ingestion run tracking.

- Source registry
- Manual ingest execution
- Run history
- Raw payload capture
- Listing normalization handoff

### `platform/sqlite`

Owns the SQLite bootstrap and the persistence implementation used by the first iteration.

- Schema creation
- Source persistence
- Run persistence
- Listing persistence
- Price event persistence

### `platform/objectstore`

Owns raw artifact storage.

- Memory-backed adapter for portable tests and lightweight local bootstraps
- S3-compatible adapter for Garage-backed runtime storage

### `transport/httpapi`

Owns the HTTP surface exposed to the frontend and the backoffice.

- Public catalog endpoints
- Health endpoints
- Auth endpoints
- User engagement endpoints
- Backoffice ingestion endpoints
- Live SSE transport

## Why A Modular Monolith

The product is still discovering the right source boundaries, rate-limit policies, and operational workflows. Starting with a monolith keeps the runtime efficient and the feedback loop short.

The implementation still enforces clear seams:

- Each bounded context has its own domain and application package.
- Persistence and object storage are hidden behind interfaces.
- The composition root is isolated in `internal/app`.
- The HTTP layer depends on services, not directly on SQL or S3 clients.

## First Iteration Scope

The first working slice deliberately implements only the minimum operational path:

1. Boot the server.
2. Initialize SQLite schema automatically.
3. Register a bootstrap source from configuration.
4. Trigger a manual server-side ingest for that source.
5. Store raw source payloads through the object-store abstraction.
6. Persist normalized listings and price changes in SQLite.
7. Expose public listing search and detail endpoints.
8. Expose bootstrap auth, engagement, and backoffice endpoints.
9. Publish live backoffice and notification events through SSE.

## Deferred Boundaries

The following modules are intentionally not implemented yet, but the architecture leaves room for them:

- Region/category aggregation services
- Coordinate-aware geospatial services
- Rich notification delivery adapters beyond the webhook hook
- Alternative real-time transports beyond the current SSE channel

## Documentation Convention

The prompt asked for extensive code documentation and JSDoc-style readability. This backend is written in Go, so the idiomatic equivalent is GoDoc-style package and symbol comments. The exported types and services in this implementation follow that convention.
