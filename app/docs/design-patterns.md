# Frontend Design Patterns

## Purpose

This document captures the implementation patterns that should stay stable as the frontend evolves. It is written for maintainers and feature developers who need to change `/app` without weakening route ownership, state boundaries, or UI consistency.

Use [architecture.md](./architecture.md) for the mounted runtime, [design-system.md](./design-system.md) for UI primitives, and [maintenance.md](./maintenance.md) for day-2 workflows.

## Use This When

Read this before you:

- add or move a route
- introduce a new service module or mutation flow
- add persistent or cross-route state
- introduce a new reusable UI primitive
- refactor auth, theme, or event-stream behavior

## Stable Patterns To Preserve

### Composition root stays small

- `src/main.tsx` owns bootstrapping and pre-render theme application.
- `src/app/AppProviders.tsx` owns provider composition.
- `src/app/router.tsx` owns mounted routes.

Do not spread runtime composition across feature files.

### Feature pages compose workflows

Feature pages and nearby feature components should assemble queries, mutations, forms, and route-specific interactions. They should not own low-level transport or cross-app shell behavior.

### Service modules own backend contract details

Each backend-backed capability should keep these concerns together under `src/services/<capability>`:

- wire-friendly DTOs
- query key factories
- request and mutation functions

Keep raw `fetch()` logic inside `src/lib/api/client.ts` and `src/lib/api/sse.ts`.

### Server state stays in TanStack Query

Remote collections, details, mutation status, retries, and invalidation belong in TanStack Query. Do not mirror backend-owned entities in Zustand.

### URL state carries shareable filters

If a view decision should survive refresh, browser navigation, or a copied URL, prefer search params over component state or global stores.

### Zustand is for cross-route client state only

The current bar for a store is intentionally high. Stores should remain limited to concerns like:

- authenticated session snapshot
- shell navigation state
- in-memory live event buffer

### Shared primitives before route-local markup

If multiple screens need the same layout, action cluster, dialog, table, or status pattern, extend `src/components/ui` and the design system instead of cloning markup into feature folders.

### Accessibility is part of the component contract

- Keep helper copy outside form labels.
- Connect helper copy with `aria-describedby`.
- Preserve stable accessible names for controls and tests.
- Keep destructive actions explicit and confirmable.

## Ownership Boundaries

| If the concern is... | It belongs in... |
| --- | --- |
| route mounting, auth gating, shell chrome | `src/app` |
| page workflows and feature-specific orchestration | `src/features` |
| backend DTOs, request functions, query keys | `src/services` |
| transport helpers, auth helpers, formatters, routing utilities | `src/lib` |
| cross-route client state | `src/stores` |
| reusable UI primitives and shared layout patterns | `src/components/ui` |
| global tokens and base styling | `src/styles` |

## Change Checklist

When you touch a cross-cutting frontend behavior, verify these together:

1. the owning route or feature boundary
2. the matching service contract or query keys
3. the shared primitive or token usage if the change affects UI reuse
4. the auth, event, or state boundary if the change crosses page lines
5. the related docs in this folder

## Anti-Patterns To Avoid

- raw `fetch()` calls in feature code or components
- new global stores for backend-owned state
- route loaders or actions for ordinary data-fetching paths the app already handles with TanStack Query
- feature-local visual patterns that should be a shared primitive
- helper copy placed inside labels, which changes accessible names and test expectations