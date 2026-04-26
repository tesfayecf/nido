# Frontend Interaction Patterns

## Purpose

This document explains the interaction rules that keep the frontend predictable and safe for operators.

## Context

The app contains many high-density workflows: forms, tables, previews, destructive actions, runs, and analytics controls. Shared interaction patterns reduce user confusion.

## Core Concepts

- Lists use searchable or filterable tables where that improves speed.
- Destructive actions require explicit confirmation.
- Mutations provide toast feedback.
- Detail pages keep related actions near the data they affect.
- Auth loss must redirect users safely.

## Behavior / Flow

Current interaction patterns:

- **Create and edit** flows use buttons plus modal dialogs or dedicated detail pages.
- **Delete** flows use `ConfirmDialog` with explicit labels.
- **Filters** stay visible near the list or chart they affect.
- **Preview before commit** is used for selector work on properties.
- **Status visibility** uses badges, timestamps, and short summary cards.
- **Navigation** groups related workflows instead of exposing a flat command list.

Important constraints:

- the app does not currently expose a live events page
- interaction docs should describe mounted routes only
- accessibility labels must stay stable because tests depend on them

## Examples

Examples of these patterns:

- Property preview and run actions in `PropertyDetailPage`
- Delete confirmations in `SourcesPage` and `RunsPage`
- Analytics controls and selected-record inspection in `AnalyticsPage`

## Related Docs

- [UI Architecture](./ui-architecture.md)
- [State Management](./state-management.md)
- [Components](./components.md)
- [Features / Operations](./features/operations.md)
- [Docs / App / Overview](../../docs/app/overview.md)
