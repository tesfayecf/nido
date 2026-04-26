# Backend Patterns

## Purpose

This document records the backend-specific implementation patterns and anti-patterns that should survive future changes.

## Context

The backend is already structured around explicit services, transport handlers, and store boundaries. This document explains when those patterns should be reused.

## Core Concepts

### Pattern: composition stays explicit
- **Description**: runtime wiring stays easy to read in `internal/app/runtime.go`.
- **When to use it**: when adding a new dependency, route group, or background service.
- **Example usage in the codebase**: `server/internal/app/runtime.go`

### Pattern: transport stays thin
- **Description**: handlers validate HTTP concerns and delegate business logic.
- **When to use it**: when adding or changing an endpoint.
- **Example usage in the codebase**: `server/internal/ingestion/transport/httpapi/property_handlers.go`

### Pattern: application services own orchestration
- **Description**: multi-step flows belong in application services instead of handlers.
- **When to use it**: when a change touches ingestion, scheduling, tagging, or engagement rules.
- **Example usage in the codebase**: `server/internal/ingestion/application`, `server/internal/engagement/application`

### Pattern: persistence stays behind store boundaries
- **Description**: SQLite queries and schema details stay in `internal/platform/sqlite`.
- **When to use it**: when data access changes.
- **Example usage in the codebase**: `server/internal/platform/sqlite`

## Behavior / Flow

Backend change checklist:

1. locate the mounted route or service owner
2. decide whether the change is transport, orchestration, or persistence
3. keep config and lifecycle decisions visible
4. update the contract docs if payloads or routes changed
5. run targeted tests and then `go test ./...`

## Examples

Anti-patterns to avoid:

- treating dormant packages as active runtime behavior
- putting SQL or scheduler policy inside handlers
- documenting parsed-only config as active product behavior
- assuming event delivery is required for correctness
- collapsing snapshots and property-run records into one concept

## Related Docs

- [Architecture](./architecture.md)
- [API Contracts](./api-contracts.md)
- [Docs / Architecture / Design Patterns](../../docs/architecture/design-patterns.md)
- [App Docs / State Management](../../app/docs/state-management.md)
