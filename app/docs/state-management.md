# Frontend State Management

## Purpose

This document explains where state belongs in the frontend and why those boundaries matter.

## Context

The frontend uses several state mechanisms. Predictability depends on using the right one for the right kind of information.

## Core Concepts

- **TanStack Query** stores backend-owned data.
- **URL search params** store linkable view state.
- **Zustand** stores cross-route client state.
- **Component state** stores local drafts and UI-only controls.

## Behavior / Flow

Use this decision order:

1. If the backend is authoritative, use TanStack Query.
2. If the state should survive refresh or be shareable, use the URL.
3. If the state is client-owned and needed across unrelated routes, use a store.
4. Otherwise keep it local to the page or component.

Current examples:

- Queries and mutations in `PropertiesPage`, `AnalyticsPage`, `FieldsPage`, and `RunsPage` use TanStack Query.
- Property list filters use URL search params.
- Session and shell state use Zustand.
- Dialog open state, draft forms, and selection state stay local.

## Examples

Examples in the codebase:

- URL filters: `app/src/features/properties/PropertiesPage.tsx`
- Query-backed analytics: `app/src/features/analytics/AnalyticsPage.tsx`
- Session store: `app/src/stores/session.store.ts`

## Related Docs

- [Overview](./overview.md)
- [UI Architecture](./ui-architecture.md)
- [Interaction Patterns](./interaction-patterns.md)
- [Features / Analytics](./features/analytics.md)
- [Docs / Architecture / Design Patterns](../../docs/architecture/design-patterns.md)
