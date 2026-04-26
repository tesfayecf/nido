# Backend Data Flow

## Purpose

This document explains the most important backend flows so maintainers can reason about behavior without reading every package first.

## Context

Most backend work falls into one of three categories: authenticated request handling, property ingestion and scheduling, or engagement and platform side effects.

## Core Concepts

- Request handling starts in transport handlers and moves into application services.
- Ingestion creates snapshots and can also create property-run records.
- Engagement and platform workflows depend on authenticated user or system context.
- Events are useful for observability, but correctness does not depend on event delivery.

## Behavior / Flow

### Authenticated request flow
1. request enters logging and CORS middleware
2. protected routes pass through auth middleware
3. handlers decode input and call application services
4. services read or write through the store
5. handlers return JSON envelopes

### Property ingestion flow
1. a property is created or selected
2. preview or ingest uses the property URL and selector configuration
3. the fetcher collects page content
4. selectors extract values into a normalized result
5. the service persists snapshots and updates property state
6. scheduler-owned attempts also persist property-run records

### Engagement flow
1. a user bookmarks a property or creates an alert rule
2. later property activity can trigger notification creation
3. notifications are listed, marked read, or marked unread through `/api/v1/me/notifications*`

### Platform flow
1. the frontend updates platform settings
2. the backend persists channel settings
3. summary and delivery logs expose the current operational state
4. test-send routes verify outbound channels without changing tracked-property data

## Examples

Important distinctions:

- `GET /api/v1/backoffice/runs` works with run records exposed by the property service.
- `GET /api/v1/backoffice/properties/{propertyID}/snapshots` returns extracted values for one property.
- `GET /api/v1/backoffice/properties/{propertyID}/runs` returns property-specific attempt history.

## Related Docs

- [Architecture](./architecture.md)
- [API Contracts](./api-contracts.md)
- [Patterns](./patterns.md)
- [Docs / Architecture / Data Model](../../docs/architecture/data-model.md)
- [Docs App / Features / Source Templates and Runs](../../docs/app/features/source-templates-and-runs.md)
