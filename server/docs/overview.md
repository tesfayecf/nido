# Backend Overview

## Purpose

This document is the entry point for backend-specific documentation.

## Context

The backend is a Go modular monolith that owns authentication, tracked-property ingestion, field normalization, analytics dataset delivery, engagement workflows, and platform settings.

## Core Concepts

- The active runtime is defined by `server/internal/app/runtime.go`.
- HTTP transport stays thin and delegates to application services.
- SQLite is the system of record.
- The backend starts background property scheduling and platform operations inside the same process.

## Behavior / Flow

Read this set in order when you are new to the backend:

1. [Architecture](./architecture.md)
2. [Data Flow](./data-flow.md)
3. [Modules](./modules.md)
4. [API Contracts](./api-contracts.md)
5. [Patterns](./patterns.md)

Backend responsibilities today:

- auth and current-user account management
- source template CRUD
- tracked-property CRUD, config, snapshots, and property runs
- field definitions and analytics dataset export
- tags, bookmarks, alert rules, and notifications
- platform settings, summary, delivery logs, and test sends

## Examples

Backend truth sources:

- `server/internal/app/runtime.go`
- `server/internal/app/runtime_test.go`
- `server/internal/ingestion/transport/httpapi`
- `server/internal/engagement/transport/httpapi`
- `server/internal/platformops/transport/httpapi`

## Related Docs

- [Architecture](./architecture.md)
- [Data Flow](./data-flow.md)
- [API Contracts](./api-contracts.md)
- [Docs / Architecture / System Design](../../docs/architecture/system-design.md)
- [App Docs / Overview](../../app/docs/overview.md)
