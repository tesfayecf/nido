# Design Patterns

## Purpose

This document records the cross-layer design patterns and anti-patterns that should remain stable as the repository evolves.

## Context

The backend and frontend have their own deeper pattern documents, but some decisions span the whole system and affect onboarding, architecture, and documentation quality.

## Core Concepts

### Pattern: explicit composition roots
- **Description**: mounted behavior is decided in a small number of startup files.
- **When to use it**: when adding runtime dependencies, routes, or global providers.
- **Example usage in the codebase**: `server/internal/app/runtime.go`, `app/src/app/router.tsx`, `app/src/app/AppProviders.tsx`

### Pattern: thin transport, typed service boundaries
- **Description**: handlers and frontend pages stay focused on transport and workflow composition while dedicated services own business orchestration or API contract logic.
- **When to use it**: when adding endpoints, mutations, or route-level workflows.
- **Example usage in the codebase**: `server/internal/ingestion/application`, `app/src/services/properties`, `app/src/features/properties/PropertyDetailPage.tsx`

### Pattern: server-authoritative business state
- **Description**: canonical domain state lives on the backend; the frontend caches or drafts around it.
- **When to use it**: when deciding whether data belongs in TanStack Query, URL state, local state, or the backend.
- **Example usage in the codebase**: `app/src/features/analytics/AnalyticsPage.tsx`, `app/src/stores/session.store.ts`

### Pattern: canonical field normalization
- **Description**: extracted values are easier to compare when they are mapped to shared field definitions.
- **When to use it**: when configuring selectors, analytics, or unmapped-field assignment.
- **Example usage in the codebase**: `server/internal/ingestion/transport/httpapi/field_handlers.go`, `app/src/features/fields/FieldsPage.tsx`

### Pattern: docs mirror the active runtime
- **Description**: documentation describes mounted behavior first and labels dormant code as dormant.
- **When to use it**: whenever code and docs diverge, or when the repository contains future-facing packages.
- **Example usage in the codebase**: `server/internal/catalog` exists, but `server/internal/app/runtime.go` does not mount it.

## Behavior / Flow

Use these checks before documenting or implementing a change:

1. Confirm whether the behavior is mounted today.
2. Identify the owning backend and frontend boundary.
3. Reuse the established state and contract patterns.
4. Update the docs closest to the changed runtime surface.
5. Link the changed document back into this documentation system.

## Examples

Anti-patterns to avoid:

- documenting dormant catalog routes as active product behavior
- describing a snapshot and a property run as the same thing
- moving backend-owned state into a new frontend global store
- adding unlinked documentation that creates a second source of truth
- using vague names such as `flow.md` instead of descriptive names such as `data-flow.md`

## Related Docs

- [System Design](./system-design.md)
- [Data Model](./data-model.md)
- [References / Conventions](../references/conventions.md)
- [Server Docs / Patterns](../../server/docs/patterns.md)
- [App Docs / Interaction Patterns](../../app/docs/interaction-patterns.md)
