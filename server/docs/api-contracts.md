# Backend API Contracts

## Purpose

This document summarizes the active backend HTTP surface and the contract patterns the frontend depends on.

## Context

The frontend consumes typed JSON envelopes from the backend. This file highlights route groups, envelope shapes, and the most important distinctions between similar endpoints.

## Core Concepts

- Most list endpoints return `{ items, count }`.
- Most detail endpoints return `{ item }`.
- Status-only endpoints return `{ status }`.
- Login returns `{ token, user, expires_at }` directly.
- Protected endpoints require auth middleware.

## Behavior / Flow

Active route groups:

| Area | Routes |
| --- | --- |
| Health | `GET /api/v1/health/live`, `GET /api/v1/health/ready` |
| Auth | `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, `PUT /api/v1/auth/me`, `POST /api/v1/auth/me/password` |
| Engagement | `/api/v1/me/bookmarks*`, `/api/v1/me/alert-rules*`, `/api/v1/me/notifications*` |
| Sources | `GET/POST /api/v1/backoffice/sources`, `GET/DELETE /api/v1/backoffice/sources/{sourceID}` |
| Properties | `/api/v1/backoffice/properties*`, property config routes, preview, ingest, snapshots, and property-run routes |
| Runs | `GET /api/v1/backoffice/runs`, `GET/DELETE /api/v1/backoffice/runs/{runID}` |
| Fields and analytics | `/api/v1/backoffice/fields*`, `/api/v1/backoffice/fields/unmapped*`, `GET /api/v1/backoffice/analytics/dataset` |
| Tags | `/api/v1/backoffice/tags*`, `/api/v1/backoffice/properties/{propertyID}/tags*` |
| Platform | `/api/v1/backoffice/platform/settings`, `/summary`, `/deliveries`, `/test/{channel}` |

Contract notes:

- Global runs and property-specific runs are different views and should be documented separately.
- Stateless preview exists at `POST /api/v1/backoffice/properties/preview`.
- Property-scoped preview exists at `POST /api/v1/backoffice/properties/{propertyID}/preview`.
- The active runtime does not mount `/api/v1/backoffice/events`.

## Examples

Examples of high-value contract pairs:

- Property CRUD and config: `server/internal/ingestion/transport/httpapi/property_handlers.go`
- Engagement flows: `server/internal/engagement/transport/httpapi/handlers.go`
- Platform settings: `server/internal/platformops/transport/httpapi/handlers.go`

## Related Docs

- [Architecture](./architecture.md)
- [Data Flow](./data-flow.md)
- [Patterns](./patterns.md)
- [App Docs / UI Architecture](../../app/docs/ui-architecture.md)
- [App Docs / Features / Operations](../../app/docs/features/operations.md)
