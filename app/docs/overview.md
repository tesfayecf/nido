# Frontend Overview

The frontend is a route-driven React app for authenticated operators.

## Owns

- route composition and auth gating
- page workflows for properties, sources, runs, fields, analytics, engagement, and settings
- typed HTTP calls to the backend
- local UI state, URL state, and small cross-route stores

## Read this first

1. `app/src/app/router.tsx`
2. [UI Architecture](./ui-architecture.md)
3. [State Management](./state-management.md)
4. `app/src/features/*`
5. `app/src/services/*`
