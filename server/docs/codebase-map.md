# Backend Codebase Map

## Purpose

Start here when you need to find the owning code quickly. This page is optimized for maintainers who need to move from a behavior or route to the right package without first reading the entire backend.

Read [architecture.md](./architecture.md) for mounted runtime behavior, [design-patterns.md](./design-patterns.md) for stable implementation rules, and [maintenance.md](./maintenance.md) for day-2 change procedures.

## Use This When

Read this when you know the behavior or route you need to change but do not yet know the owning package, transport layer, or test anchor.

## First Files To Open

1. `cmd/server/main.go` for command dispatch and HTTP server lifecycle
2. `internal/app/runtime.go` for the active composition root
3. `internal/platform/config/config.go` for env parsing, defaults, and validation
4. `internal/app/runtime_test.go` for route-wiring and end-to-end backend smoke tests

## Directory Map

| Path | Responsibility | Start here |
| --- | --- | --- |
| `cmd/server` | Process entrypoint, `serve` and `migrate` commands, graceful shutdown | `main.go` |
| `internal/app` | Composition root, health endpoints, runtime lifecycle tests | `runtime.go`, `runtime_test.go` |
| `internal/auth` | Bootstrap admin, bearer sessions, auth middleware, current principal lookup | `application/service.go`, `transport/httpapi/handlers.go` |
| `internal/engagement` | Bookmarks, alert rules, notifications, notification publishing | `application/service.go`, `transport/httpapi/handlers.go` |
| `internal/ingestion/application` | Source CRUD, property preview and ingest, scheduler, fields, tags, snapshot and run orchestration | `service.go`, `property_service.go`, `property_scheduler.go`, `field_service.go`, `tag_service.go` |
| `internal/ingestion/transport/httpapi` | Backoffice source, run, event, property, field, and tag HTTP handlers | `handlers.go`, `property_handlers.go`, `field_handlers.go`, `tag_handlers.go` |
| `internal/ingestion/connectors` | Source-kind-specific adapter code for HTML listings, JSON feeds, and JSON-LD inputs | connector package matching the source kind |
| `internal/ingestion/browser` | Optional server-side browser renderer used when fetcher escalation is required | renderer implementation |
| `internal/fetcher` | Shared HTTP retrieval, anti-bot challenge handling, TLS profiles, browser fallback boundary | `client.go`, `challenge.go`, `tls.go` |
| `internal/parser` | Low-level parsers for `htmllistings`, `httpjson`, and `htmljsonld` payloads | parser package matching the payload type |
| `internal/platform/sqlite` | SQLite bootstrap, migrations, and repository implementation | `db.go`, `store.go`, `field_store.go` |
| `internal/platform/httpapi` | JSON helpers, route params, CORS, request logging, and SSE helpers | `json.go`, `params.go`, `cors.go`, `logging.go`, `sse.go` |
| `internal/platform/events` | In-process pub/sub broker used for live event streaming | broker package |
| `internal/platform/config` | Environment parsing, defaults, validation, and config alias handling | `config.go` |
| `internal/platformops` | Platform settings, summary views, delivery log visibility, and test-channel routes | `application/service.go`, `transport/httpapi/handlers.go` |
| `internal/engine` | Worker-pool primitives used by the property scheduler | engine package when concurrency behavior changes |
| `internal/catalog` | Legacy public listings surface that still exists in repo but is not mounted | `transport/httpapi/handlers.go` |
| `internal/platform/objectstore` | Memory and S3-compatible storage adapters present in repo but not composed by the active runtime | object-store package |

## Common Change Paths

| If you need to change... | Start here | Then confirm in... |
| --- | --- | --- |
| Whether a route is mounted at all | `internal/app/runtime.go` | `internal/app/runtime_test.go` |
| Auth login, session, or profile behavior | `internal/auth/transport/httpapi/handlers.go` | `internal/auth/application/service.go` |
| Bookmarks, alerts, or notifications | `internal/engagement/application/service.go` | `internal/engagement/transport/httpapi/handlers.go` |
| Source CRUD, global runs, or the SSE endpoint | `internal/ingestion/transport/httpapi/handlers.go` | `internal/ingestion/application/service.go` |
| Property preview, config versioning, ingest, or snapshots | `internal/ingestion/application/property_service.go` | `internal/ingestion/transport/httpapi/property_handlers.go` |
| Scheduler timing, retries, or concurrency | `internal/ingestion/application/property_scheduler.go` | `internal/app/runtime.go` |
| Field definitions, unmapped-field assignment, or analytics dataset output | `internal/ingestion/application/field_service.go` | `internal/ingestion/transport/httpapi/field_handlers.go` |
| Tag creation or property-tag assignment | `internal/ingestion/application/tag_service.go` | `internal/ingestion/transport/httpapi/tag_handlers.go` |
| Platform settings, delivery logs, or notification test routes | `internal/platformops/application/service.go` | `internal/platformops/transport/httpapi/handlers.go` |
| Schema, queries, or repository persistence behavior | `internal/platform/sqlite/store.go` | `internal/platform/sqlite/db.go` and `internal/platform/sqlite/field_store.go` |
| CORS, JSON errors, request logging, or SSE transport behavior | `internal/platform/httpapi` | `internal/app/runtime.go` |
| An env var that does not seem to do anything | `internal/platform/config/config.go` | `internal/app/runtime.go` |
| Anti-bot handling or browser fallback | `internal/fetcher` | `internal/ingestion/browser` |
| Source-kind extraction behavior | matching package under `internal/ingestion/connectors` or `internal/parser` | `internal/ingestion/application/service.go` or `property_service.go` |

## Test Anchors

Use the tests as an executable map of the backend:

- `internal/app/runtime_test.go`: runtime wiring, CORS, auth, property flow, engagement flow, and analytics dataset coverage
- `internal/ingestion/application/property_service_test.go`: property preview, ingest, snapshots, and extraction behavior
- `internal/ingestion/application/property_scheduler_test.go`: tick behavior, retries, and scheduler concurrency
- `internal/ingestion/application/field_service_test.go`: field lifecycle and unmapped-field handling
- `internal/ingestion/application/service_test.go`: source service behavior
- `internal/ingestion/application/tag_service_test.go`: tag behavior
- `internal/engagement/application/service_test.go`: bookmarks, alert rules, and notifications
- `internal/platform/config/config_test.go`: environment parsing and alias handling
- `internal/fetcher/client_test.go` and `internal/fetcher/challenge_test.go`: fetcher behavior and challenge handling
- `internal/ingestion/connectors/htmllistings/connector_test.go`: connector-specific behavior

## Design Patterns To Preserve

- Keep `cmd/server/main.go` and `internal/app/runtime.go` as the source of truth for mounted behavior.
- Keep handlers thin and application services responsible for orchestration.
- Keep persistence details inside `internal/platform/sqlite`.
- Keep the distinction between mounted runtime and dormant repository surfaces explicit in docs and code reviews.

For the longer rationale and anti-patterns, continue in [design-patterns.md](./design-patterns.md).

## Active Runtime Vs Dormant Surfaces

Mounted today:

- health endpoints
- auth routes
- engagement routes
- source CRUD
- property CRUD, preview, ingest, snapshots, config versions, and scheduler-run history
- fields and analytics dataset routes
- tags
- global runs and SSE events
- platform settings, summary, deliveries, and test-channel routes

Present in repo but not mounted end to end today:

- public listings routes under `internal/catalog`
- object-store runtime wiring
- bootstrap-source auto registration from config
- config-driven scheduler enable or disable behavior
- broader source-ingest orchestration beyond tracked-property workflows

When a maintainer says "the backend supports X", verify first that `internal/app/runtime.go` actually wires it.