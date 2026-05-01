# Backend Overview

The backend is one Go process with one active runtime.

## Owns

- auth and current-user flows
- sources, properties, snapshots, and property runs
- fields, tags, and analytics dataset delivery
- bookmarks, alerts, and notifications
- platform settings, backup, restore, and delivery operations

## Read this first

1. `server/internal/app/runtime.go`
2. [Architecture](./architecture.md)
3. [Data Flow](./data-flow.md)
4. [Modules](./modules.md)
5. [API Contracts](./api-contracts.md)

## Change entry points

- route wiring: `server/internal/app/runtime.go`
- HTTP handlers: `server/internal/*/transport/httpapi`
- business logic: `server/internal/*/application`
- persistence: `server/internal/platform/sqlite`
