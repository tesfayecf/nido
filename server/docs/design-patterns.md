# Backend Design Patterns

## Purpose

This document captures the implementation patterns that should stay stable as the Go backend evolves. It is written for maintainers and feature developers who need to change `/server` without blurring runtime ownership, service orchestration, or operational boundaries.

Use [architecture.md](./architecture.md) for the mounted runtime, [codebase-map.md](./codebase-map.md) for package navigation, and [maintenance.md](./maintenance.md) for day-2 workflows.

## Use This When

Read this before you:

- add or mount an endpoint
- refactor a handler or application service
- change scheduler, fetcher, or background lifecycle behavior
- add new config that should affect the active runtime
- change persistence, event publishing, or browser fallback behavior

## Stable Patterns To Preserve

### The composition root stays explicit

`cmd/server/main.go` and `internal/app/runtime.go` should remain the place where maintainers can understand what the backend actually mounts, starts, and depends on.

### Transport stays thin

Handlers should decode requests, validate obvious HTTP issues, call the owning application service, and write the response. Business rules do not belong in transport code.

### Application services own orchestration

Use application services for multi-step behavior such as:

- auth and current-user flows
- engagement workflows
- property preview, ingest, and scheduling
- field, tag, and platform operations

This keeps handlers replaceable and tests focused on where decisions are made.

### Persistence stays behind the SQLite store boundary

Schema knowledge and query details should stay in `internal/platform/sqlite` rather than leaking into handlers or duplicating SQL across packages.

### Scheduler and lifecycle defaults stay visible

Concurrency, startup order, background services, and shutdown behavior should stay visible in the composition root or in clearly owned scheduler code. Hidden defaults create operational surprises.

### Events are best-effort observability

SSE and event publishing are for visibility and operator awareness. They must not become the only path that preserves correctness-critical state.

### Config is only real when the runtime consumes it

If a setting is parsed but `internal/app/runtime.go` does not wire it into the active runtime, document it as parsed-only rather than as a product guarantee.

### Browser fallback remains optional and explicit

The fetcher and renderer boundary should keep browser execution isolated. Do not silently escalate every fetch into browser automation.

## Ownership Boundaries

| If the concern is... | It belongs in... |
| --- | --- |
| process lifecycle, mounted routes, middleware, dependency graph | `cmd/server` and `internal/app` |
| JSON decoding, auth context extraction, HTTP response writing | `internal/*/transport/httpapi` |
| business rules and orchestration | `internal/*/application` |
| schema, migrations, and repository queries | `internal/platform/sqlite` |
| event broker, CORS, logging, SSE helpers, config parsing | `internal/platform` |
| fetcher, parser, browser fallback, worker-pool behavior | `internal/fetcher`, `internal/parser`, `internal/ingestion/browser`, `internal/engine` |

## Change Checklist

When you touch a cross-cutting backend behavior, verify these together:

1. the mounted route or runtime boundary
2. the owning application service
3. the persistence or config boundary if the change affects data or lifecycle
4. runtime tests or package-local tests closest to the decision point
5. the related docs in this folder and any frontend contract docs that consume the route

## Anti-Patterns To Avoid

- adding behavior to handlers that belongs in an application service
- writing SQL or schema logic directly in transport code
- hiding scheduler defaults or background-service startup inside distant helpers
- treating parsed-only config as active runtime behavior
- making correctness depend on SSE delivery or notification side effects