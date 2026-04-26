# Backend Architecture

## Purpose

This document explains how the backend runtime is assembled and which boundaries matter most.

## Context

The backend is one process with one mounted runtime. The repository contains extra packages, but only the runtime composition root defines active product behavior.

## Core Concepts

- `server/internal/app/runtime.go` is the composition root.
- `cmd/server/main.go` owns process startup and shutdown.
- Transport handlers live under `server/internal/*/transport/httpapi`.
- Application services live under `server/internal/*/application`.
- Persistence lives in `server/internal/platform/sqlite`.

## Behavior / Flow

Runtime startup sequence:

1. load config and open SQLite
2. run migrations and create the shared store
3. create the event broker, fetcher, and optional browser renderer
4. bootstrap the admin user
5. create auth, engagement, ingestion, field, tag, and platform services
6. start the property scheduler and platform operations service
7. register health, auth, engagement, ingestion, property, field, tag, and platform routes
8. wrap the mux with CORS and logging middleware

Mounted surface highlights:

- `/api/v1/auth/*`
- `/api/v1/me/*`
- `/api/v1/backoffice/sources*`
- `/api/v1/backoffice/properties*`
- `/api/v1/backoffice/runs*`
- `/api/v1/backoffice/fields*`
- `/api/v1/backoffice/analytics/dataset`
- `/api/v1/backoffice/tags*`
- `/api/v1/backoffice/platform/*`

Dormant packages such as `internal/catalog` are not part of the active runtime because `runtime.go` does not mount them.

## Examples

Examples of runtime-owned decisions:

- scheduler concurrency is wired in `server/internal/app/runtime.go`
- health endpoints are registered directly in `server/internal/app/runtime.go`
- mounted handler groups are registered through `Register*` functions in transport packages

## Related Docs

- [Overview](./overview.md)
- [Data Flow](./data-flow.md)
- [Modules](./modules.md)
- [Patterns](./patterns.md)
- [Docs / Architecture / System Design](../../docs/architecture/system-design.md)
- [App Docs / UI Architecture](../../app/docs/ui-architecture.md)
