# Backend Modules

## Purpose

This document maps the active backend responsibilities to the packages that own them.

## Context

The backend is easier to change when ownership stays obvious. This file answers “where should this change go?” before deeper implementation work starts.

## Core Concepts

- `internal/app` owns runtime composition.
- `internal/auth` owns login and current-user account flows.
- `internal/engagement` owns bookmarks, alert rules, and notifications.
- `internal/ingestion` owns source templates, tracked properties, snapshots, property runs, fields, analytics dataset export, and tags.
- `internal/platformops` owns platform settings and delivery operations.
- `internal/platform` owns shared infrastructure such as config, HTTP helpers, events, and SQLite.

## Behavior / Flow

Ownership map:

| Concern | Primary package | Supporting packages |
| --- | --- | --- |
| Runtime composition | `internal/app` | `cmd/server`, `internal/platform/config` |
| Auth | `internal/auth` | `internal/platform/httpapi`, `internal/platform/sqlite` |
| Engagement | `internal/engagement` | `internal/platform/events`, `internal/platform/sqlite` |
| Source templates and tracked properties | `internal/ingestion` | `internal/fetcher`, `internal/ingestion/browser`, `internal/platform/sqlite` |
| Fields and analytics dataset | `internal/ingestion` | `internal/platform/sqlite` |
| Tags | `internal/ingestion` | `internal/platform/events`, `internal/platform/sqlite` |
| Platform settings and deliveries | `internal/platformops` | `internal/platform/sqlite`, `internal/platform/events` |

Dormant or future-facing packages:

- `internal/catalog`
- `internal/platform/objectstore`

## Examples

If the change is about:

- endpoint shape, edit transport handlers first
- business rules, edit the owning application service
- persistence or schema, edit `internal/platform/sqlite`
- startup or mounted behavior, edit `internal/app/runtime.go`

## Related Docs

- [Architecture](./architecture.md)
- [API Contracts](./api-contracts.md)
- [Patterns](./patterns.md)
- [Docs / Guides / Common Tasks](../../docs/guides/common-tasks.md)
