# System Design

## Purpose

This document describes the shared system shape that spans the backend, frontend, and product workflows.

## Context

Nido is implemented as a modular monolith backend plus a single-page frontend. The backend is authoritative for domain data and workflow state. The frontend composes authenticated operator workflows on top of that backend.

## Core Concepts

- The backend composition root is `server/internal/app/runtime.go`.
- The frontend composition root is `app/src/main.tsx` plus `app/src/app/router.tsx`.
- The backend owns persistence, scheduling, ingestion, and notification side effects.
- The frontend owns route composition, interaction state, and authenticated UX.
- Documentation must describe the active runtime, not dormant packages.

## Behavior / Flow

Cross-layer structure:

1. The browser loads the frontend shell and authenticated routes.
2. Frontend pages call typed service modules.
3. Service modules call backend HTTP endpoints under `/api/v1/*`.
4. Backend transport handlers delegate to application services.
5. Application services read and write SQLite through store abstractions.
6. Background schedulers and platform operations run inside the backend process.

Layer boundaries:

- **`/docs`** explains repository-wide concepts and onboarding.
- **`/server/docs`** explains backend runtime ownership and HTTP/data flow.
- **`/app/docs`** explains frontend route, state, and component patterns.
- **`/docs/app`** explains user-facing workflows.

## Examples

Examples of authoritative runtime files:

- Backend runtime: `server/internal/app/runtime.go`
- Frontend route map: `app/src/app/router.tsx`
- Frontend shell navigation: `app/src/components/shell/navigation.ts`
- Backend API registration: `server/internal/*/transport/httpapi/*.go`

## Related Docs

- [Data Model](./data-model.md)
- [Design Patterns](./design-patterns.md)
- [Server Docs / Architecture](../../server/docs/architecture.md)
- [Server Docs / Data Flow](../../server/docs/data-flow.md)
- [App Docs / UI Architecture](../../app/docs/ui-architecture.md)
- [App Docs / State Management](../../app/docs/state-management.md)
