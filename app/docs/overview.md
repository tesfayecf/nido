# Frontend Overview

The frontend is a route-driven React app for authenticated operators.

## Owns

- route composition and auth gating
- page workflows for properties, sources, runs, fields, analytics, engagement, and settings
- typed HTTP calls to the backend
- local UI state, URL state, and small cross-route stores

## Read this first

1. `app/src/app/router.tsx`
2. [Frontend Documentation Hub](../../docs/frontend/README.md)
3. [Frontend Architecture Overview](../../docs/frontend/architecture-overview.md)
4. [UI Architecture](./ui-architecture.md)
5. [State Management](./state-management.md)
6. [Codebase Navigation](../../docs/frontend/codebase-navigation.md)
7. `app/src/features/*`
8. `app/src/services/*`

## Documentation standard

- Every frontend source file under `app/src` begins with a structured header.
- Exported components and non-trivial functions include adjacent comments for purpose, rendering or operation, state, side effects, performance, return values, and edge cases as applicable.
- Critical logic blocks call out why the logic exists and what breaks if it is changed incorrectly.
- New files should start from the [Frontend Documentation Template](../../docs/frontend/documentation-template.md).
