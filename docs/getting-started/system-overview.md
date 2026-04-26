# System Overview

## Purpose

This document gives the fastest accurate mental model of the product and repository.

## Context

Nido is a monorepo for a property-tracking workspace. The backend stores and processes tracked-property data. The frontend exposes that data through an authenticated operator console.

## Core Concepts

- **Source template**: reusable extraction template for a site or feed
- **Tracked property**: a specific URL plus schedule, retry, and business metadata
- **Property config**: versioned selector rules for one tracked property
- **Snapshot**: extracted values captured during an ingest
- **Property run**: scheduler attempt record for a tracked property
- **Field definition**: canonical field used for normalization and analytics
- **Engagement workflow**: bookmarks, alert rules, and notifications tied to the current user

## Behavior / Flow

The high-level system flow is:

1. Create or maintain a source template
2. Create a tracked property that references a source template
3. Preview or save selector configuration for that property
4. Run ingestion manually or through the scheduler
5. Persist snapshots and property-run history
6. Use fields and analytics to interpret normalized data
7. Use bookmarks, alerts, and notifications for follow-up

Repository layout:

- `/app` — React 19, Vite, TanStack Query, Zustand, shared UI components
- `/server` — Go backend, SQLite persistence, modular monolith layout
- `/docs` — onboarding, architecture, user docs, shared references
- `/cmd` — helper scripts for local workflows

## Examples

A common operator journey:

- create a property
- map selectors to canonical fields
- trigger an ingest
- inspect snapshots and property-run status
- review analytics and configure alerts

## Related Docs

- [Quick Start](./quick-start.md)
- [Architecture / System Design](../architecture/system-design.md)
- [Architecture / Data Model](../architecture/data-model.md)
- [Docs App / Overview](../app/overview.md)
- [Server Docs / Data Flow](../../server/docs/data-flow.md)
- [App Docs / UI Architecture](../../app/docs/ui-architecture.md)
