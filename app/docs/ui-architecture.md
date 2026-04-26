# Frontend UI Architecture

## Purpose

This document explains the mounted route structure, shell organization, and feature boundaries of the frontend.

## Context

The frontend is intentionally route-driven. Pages own workflow composition while shared providers, shell elements, and service modules keep cross-cutting behavior centralized.

## Core Concepts

- `/login` is the only unauthenticated route.
- The index route redirects to `/properties`.
- `AppShell` owns shared layout, navigation, and outlet composition.
- `RequireAuth` protects the authenticated route tree.
- Feature pages live under `app/src/features`.

## Behavior / Flow

Mounted routes today:

| Route | Purpose |
| --- | --- |
| `/login` | sign in |
| `/dashboard` | operator overview |
| `/triage` | review queue |
| `/properties`, `/properties/new`, `/properties/:propertyId` | tracked-property workflow |
| `/properties/:propertyId/fields/:fieldName/analysis` | field-level selector analysis |
| `/analytics` | analytics workbench |
| `/fields` | canonical field management |
| `/sources`, `/sources/new`, `/sources/:sourceId` | source-template management |
| `/runs`, `/runs/:runId` | run inspection |
| `/tags` | tag management |
| `/bookmarks`, `/alerts`, `/notifications` | engagement workflows |
| `/settings` | account settings |
| `/admin` | platform administration |

Navigation groups today:

- Core workflow: Properties, Market Analysis, Saved / Shortlist, Alerts
- Operations: Overview, Review Queue, Notifications
- Admin / Advanced: Admin Console, Sources, Runs, Fields, Tags
- Account: Settings

## Examples

Examples of route owners:

- Properties: `app/src/features/properties`
- Analytics: `app/src/features/analytics`
- Backoffice operations: `app/src/features/backoffice`
- Engagement: `app/src/features/engagement`

## Related Docs

- [Overview](./overview.md)
- [State Management](./state-management.md)
- [Components](./components.md)
- [Features / Properties](./features/properties.md)
- [Server Docs / API Contracts](../../server/docs/api-contracts.md)
