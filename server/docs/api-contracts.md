<!--
File Name: docs/api-contracts.md
Purpose: Documents backend behavior for api-contracts.
Responsibilities:
- Preserve human-readable backend knowledge.
- Cross-reference related source folders and files.
- Keep documentation synchronized with implementation behavior.
Inputs / Outputs: Markdown consumed by backend contributors and reviewers.
Dependencies: Backend source files and adjacent documentation.
Side Effects: None.
Critical Notes: Update this file when the described backend behavior changes.
-->

# Backend API Contracts

## Purpose

This document summarizes the active backend HTTP surface and the contract patterns the frontend depends on.

## Context

The frontend consumes typed JSON envelopes from the backend. This file highlights route groups, envelope shapes, and the most important distinctions between similar endpoints.

## Core Concepts

- List endpoints return `{ data, items, count, pagination, meta? }`; `items` and `count` remain for existing consumers, while new clients should prefer `data` and `pagination`.
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
| Fields and analytics | `/api/v1/backoffice/fields*`, `GET /api/v1/backoffice/analytics/dataset` |
| Tags | `/api/v1/backoffice/tags*`, `/api/v1/backoffice/properties/{propertyID}/tags*` |
| Platform | `/api/v1/backoffice/platform/settings`, `/summary`, `/deliveries`, `/test/{channel}` |

Contract notes:

- Collection endpoints enforce pagination with a default page size of 50 and a hard maximum of 100 items per response.
- Offset pagination uses `page` and `pageSize` (or existing `limit` as a page-size alias); responses include `total`, `page`, `pageSize`, `hasNext`, and `hasPrevious`.
- Cursor pagination uses `cursor` and `limit`; responses include `nextCursor` and `prevCursor` when adjacent pages are available.
- Collection responses include `ETag` and `Cache-Control: private, max-age=30, must-revalidate`; clients may send `If-None-Match` and receive `304 Not Modified` for unchanged deterministic requests.
- List queries are ordered by stable keys such as `created_at`/`observed_at` plus `id` tie-breakers so repeated page reads remain deterministic between mutations.
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
