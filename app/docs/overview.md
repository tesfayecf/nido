# Frontend Overview

## Purpose

This document is the entry point for frontend-specific documentation.

## Context

The frontend is a React single-page application for authenticated operators. It exposes property tracking, analytics, engagement, source template management, run inspection, and platform settings.

## Core Concepts

- `app/src/app/router.tsx` defines the mounted route surface.
- `app/src/components/shell/navigation.ts` defines the visible navigation structure.
- TanStack Query owns server state.
- Zustand is limited to cross-route client concerns such as session and shell state.
- Shared UI components live under `app/src/components`.

## Behavior / Flow

Read this set in order when you are new to the frontend:

1. [Design Brief](./design-brief.md)
2. [Page Inventory & Wireframes](./page-inventory.md)
3. [Design System Brief](./design-system-brief.md)
4. [UI Architecture](./ui-architecture.md)
5. [State Management](./state-management.md)
6. [Components](./components.md)
7. [Interaction Patterns](./interaction-patterns.md)
8. Feature guides under [features](./features)

Frontend responsibilities today:

- route composition and auth gating
- shell layout and navigation
- typed service calls into the backend
- page-level forms, dialogs, toasts, filters, and review flows
- chart and analytics presentation

## Examples

Frontend truth sources:

- `app/src/app/router.tsx`
- `app/src/components/shell/navigation.ts`
- `app/src/app/RequireAuth.tsx`
- `app/src/services/*`

## Related Docs

- [Design Brief](./design-brief.md)
- [Page Inventory & Wireframes](./page-inventory.md)
- [Design System Brief](./design-system-brief.md)
- [UI Architecture](./ui-architecture.md)
- [State Management](./state-management.md)
- [Interaction Patterns](./interaction-patterns.md)
- [Docs / Architecture / System Design](../../docs/architecture/system-design.md)
- [Server Docs / Overview](../../server/docs/overview.md)
