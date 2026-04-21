# Frontend Iterations

## Iteration 0: Docs And Runtime Foundation

Status: implemented in this slice

- Document the frontend architecture under `/app/docs`.
- Establish package scripts for dev, build, typecheck, lint, and test.
- Add the base React runtime, routing, styling tokens, and provider composition.
- Define the typed API and state boundaries before feature work expands.

## Iteration 1: Balanced App Shell

Status: implemented and under hardening

- Login and logout flow
- Public listing explorer and detail pages
- Bookmark, watchlist, alert-rule, and notification views
- Backoffice source and run pages
- Manual ingest trigger
- Live ingest events rail

This is the first fully operable frontend slice and should work against the backend exactly as it exists today.

## Iteration 2: Map Foundation

Planned later

- Add a MapLibre adapter module
- Prepare viewport and selection state
- Keep the map feature gated until backend geospatial data exists

## Iteration 3: Market Intelligence Views

Planned later

- Regional comparisons
- Category comparisons
- Trend views
- Anomaly surfacing

This iteration depends on backend aggregate endpoints and richer listing metadata. It should not be approximated from the current flat listing contract.