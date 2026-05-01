# Frontend State Management

Use the smallest state tool that matches the job.

## Order of preference

1. **TanStack Query** for backend-owned data
2. **URL params** for shareable or refresh-stable page state
3. **Zustand** only for cross-route client state
4. **Component state** for everything local

## Current cross-route stores

- `app/src/stores/session.store.ts` for auth session
- `app/src/stores/shell.store.ts` for shell UI state

## Rule

If a value is only needed by one page, keep it on that page.
