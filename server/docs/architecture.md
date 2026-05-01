# Backend Architecture

## Runtime shape

`server/internal/app/runtime.go` builds the backend in one place:

1. load config and open SQLite
2. run migrations
3. create shared infrastructure such as events, fetcher, and renderer
4. build auth, engagement, ingestion, tag, field, and platform services
5. start the property scheduler
6. register HTTP routes
7. wrap the mux with logging and CORS middleware

## Mounted API surface

- `/api/v1/auth/*`
- `/api/v1/me/*`
- `/api/v1/backoffice/sources*`
- `/api/v1/backoffice/properties*`
- `/api/v1/backoffice/runs*`
- `/api/v1/backoffice/fields*`
- `/api/v1/backoffice/analytics/dataset`
- `/api/v1/backoffice/tags*`
- `/api/v1/backoffice/platform/*`

## Simplification notes

- the runtime no longer carries an unused source-scheduler shutdown path
- only the active property scheduler remains mounted
- removed code paths are no longer documented as if they were active features
