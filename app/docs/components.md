# Frontend Components

## Purpose

This document explains the reusable component layers used throughout the frontend.

## Context

The frontend depends on a shared component library for consistent tables, dialogs, form controls, cards, badges, and selector-editing interactions.

## Core Concepts

- `app/src/components/ui` contains shared UI primitives.
- `app/src/components/shell` contains application chrome and navigation.
- `app/src/components/selectors` contains selector-building UI.
- Feature folders can compose these pieces but should not duplicate them.

## Behavior / Flow

Component layering:

1. shared visual primitives in `components/ui`
2. shell-level structure in `components/shell`
3. specialized shared widgets such as selectors or tags
4. feature pages that assemble the workflow

Reusable patterns currently visible in the app:

- `PageCard`, `PageStack`, and `DataTable` for page structure
- `Dialog` and `ConfirmDialog` for focused or destructive actions
- `Field`, `Input`, `Select`, and `Textarea` for form composition
- `SelectorBuilder` for property extraction rule editing
- `StatusBadge`, `TagBadge`, and `RowActions` for dense operational lists

## Examples

Examples in active use:

- `app/src/features/properties/PropertyDetailPage.tsx`
- `app/src/features/fields/FieldsPage.tsx`
- `app/src/features/backoffice/SourcesPage.tsx`

## Related Docs

- [UI Architecture](./ui-architecture.md)
- [Interaction Patterns](./interaction-patterns.md)
- [Features / Properties](./features/properties.md)
- [Docs / App / Tutorials / Configuring Fields](../../docs/app/tutorials/configuring-fields.md)
