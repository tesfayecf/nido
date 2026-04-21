# Iteration Roadmap

## Iteration 0: Bootstrap

Status: implemented in this slice

- Create the backend docs set.
- Create a Go module under `/server`.
- Add a composition root and a runnable HTTP server.
- Add SQLite schema bootstrap.
- Add a portable object-store abstraction.
- Add the first backoffice and catalog endpoints.

## Iteration 1: Operational HTTP Ingestion

Status: implemented in this slice

- Register a bootstrap source from configuration.
- Fetch source data on the server.
- Parse a bootstrap HTTP JSON feed contract.
- Persist listings, snapshots, runs, and price events.
- Capture raw payload artifacts through the object-store abstraction.

This iteration intentionally uses a generic HTTP JSON feed connector because no real portal-specific source has been selected yet.

## Iteration 2: Real Portal Connectors

Status: implemented in this slice

- Add an HTML JSON-LD portal connector alongside the bootstrap HTTP JSON feed connector.
- Add resilient fetch policies, rate-limit windows, retry strategies, and source scheduling.
- Add ingestion locking for manual and scheduled runs.
- Add richer run diagnostics and failure artifacts.
- Keep Garage-backed object storage available as the local S3-compatible runtime path.

## Iteration 3: Browser-Capable Scraping

Status: implemented in this slice

- Add a server-side browser automation adapter for sources that require JavaScript execution.
- Keep the browser dependency optional and isolated behind the ingestion connector boundary.

## Iteration 4: User Features

Status: implemented in this slice

- Bootstrap-admin authentication with bearer sessions.
- Bookmarks and watchlists.
- Alert rules and notifications.
- Live backoffice progress transport through SSE.
