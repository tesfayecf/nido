# Frontend Codebase Map

## Purpose

Use this document when you need to answer two questions quickly:

1. Where does a change belong?
2. Which nearby files usually change with it?

Read [architecture.md](./architecture.md) for runtime behavior, [design-system.md](./design-system.md) for implementation-level UI rules, and [maintenance.md](./maintenance.md) for change procedures.

## Five-Minute Orientation

1. Start at `src/main.tsx` to see how the app boots.
2. Move to `src/app/AppProviders.tsx` for providers and `src/app/router.tsx` for the mounted routes.
3. Use `src/components/shell/navigation.ts` to understand how routes are grouped in the authenticated shell.
4. Open the owning page in `src/features/<capability>`.
5. Follow imports into `src/services/<capability>` for backend data and `src/components/*` for reusable UI.

## Runtime Chain

```text
src/main.tsx
  -> src/app/AppProviders.tsx
  -> src/app/router.tsx
  -> src/app/AppShell.tsx
  -> src/features/*Page.tsx
  -> src/services/*/*.service.ts
  -> src/lib/api/client.ts
  -> /api/v1/*
```

When a workflow uses live backoffice events, the request path forks through `src/lib/api/sse.ts`, `src/services/backoffice-events/events.service.ts`, and `src/stores/live-events.store.ts`.

## Source Tree Map

| Area | What lives here | Start here when |
| --- | --- | --- |
| `src/main.tsx` | App bootstrap and initial theme application | You need to change startup behavior or pre-render setup |
| `src/app` | Providers, router, authenticated shell, auth guard, route error boundary | You need to mount a route, adjust auth gating, or change shell-level layout |
| `src/features` | Route-owned workflows and feature-specific orchestration | You need to change page behavior, queries, forms, tables, or dialogs for one workflow |
| `src/services` | Capability-scoped DTOs, query keys, and request functions | You need to change backend contract handling or query invalidation |
| `src/components/ui` | Shared primitives such as `DataTable`, `PageCard`, `Toolbar`, `Dialog`, `StatusBadge`, and form controls | You need a reusable UI pattern instead of one-off markup |
| `src/components/shell` | Navigation, header, theme toggle, and route metadata | You need to change shell chrome or page framing |
| `src/components/selectors` | Reusable selector-building UI | You are working on extraction selector authoring UX |
| `src/components/tags` | Tag badges, filters, and pickers | You are working on property tagging and tag-driven filters |
| `src/lib` | Technical helpers for API transport, auth helpers, formatting, forms, routing, and UI utilities | You need cross-feature plumbing without business ownership |
| `src/stores` | Small Zustand stores for session, shell state, and live events | You need cross-route client state that is not canonical on the backend |
| `src/styles` | Global tokens and shared CSS primitives | You need token or base-style changes |
| `src/test` | Shared Vitest and Testing Library wiring | You need test helpers or provider setup |

## Feature And Route Ownership

The shell navigation groups live in `src/components/shell/navigation.ts`. Use them to find the owning feature quickly.

| Shell section | Paths | Owner | Notes |
| --- | --- | --- | --- |
| Core workflow | `/properties`, `/properties/new`, `/properties/:propertyId`, `/properties/:propertyId/fields/:fieldName/analysis` | `src/features/properties` | Primary tracked-property workflows, config versions, manual ingest, snapshots, and field analysis |
| Core workflow | `/analytics` | `src/features/analytics` | Market analysis views backed by analytics and field definitions |
| Core workflow | `/bookmarks`, `/alerts` | `src/features/engagement` | User-driven follow-up workflows layered on top of property data |
| Operations | `/dashboard`, `/triage` | `src/features/operators` | Operator overview, review queue, and command-palette workflows |
| Operations | `/notifications` | `src/features/engagement` | Notification review and acknowledgement |
| Admin / Advanced | `/sources`, `/sources/new`, `/sources/:sourceId` | `src/features/backoffice` | Source CRUD, field editor support, and stateless extraction preview |
| Admin / Advanced | `/runs`, `/runs/:runId`, `/events` | `src/features/backoffice` | Global snapshot history and live in-session diagnostics |
| Admin / Advanced | `/fields` | `src/features/fields` | Field definition management and unmapped-field workflows |
| Admin / Advanced | `/tags` | `src/features/tags` | Tag CRUD and categorization helpers |
| Admin / Advanced | `/admin` | `src/features/platform` | Platform summary, settings, integrations, and admin-side coordination |
| Account | `/settings` | `src/features/settings` | Profile, password, quiet hours, and notification preferences |
| Access | `/login` | `src/features/auth` | Authentication and redirect recovery |

## Service Module Pattern

Every capability in `src/services` follows the same shape when it talks to the backend:

- `*.types.ts` defines wire-friendly DTOs.
- `*.service.ts` owns request functions.
- `*.keys.ts` owns TanStack Query keys.

Representative service areas in active use:

- `analytics`
- `alert-rules`
- `auth`
- `backoffice-events`
- `backoffice-runs`
- `backoffice-sources`
- `bookmarks`
- `fields`
- `notifications`
- `platform`
- `properties`
- `tags`

Keep transport details inside services and `src/lib/api`. Feature pages should compose queries and mutations, not reimplement HTTP concerns.

## Common Maintenance Paths

| If you need to... | Start here | Usually touch next |
| --- | --- | --- |
| Add or remove a route | `src/app/router.tsx` | `src/components/shell/navigation.ts`, the owning page, and docs in this folder |
| Add a backend-backed workflow | `src/features/<capability>` | `src/services/<capability>`, [backend-contract.md](./backend-contract.md), and focused tests |
| Change auth or logout behavior | `src/app/RequireAuth.tsx` | `src/stores/session.store.ts`, `src/services/auth`, and `src/lib/api/client.ts` |
| Change shell navigation or responsive layout | `src/app/AppShell.tsx` | `src/components/shell/*` and `src/stores/shell.store.ts` |
| Change live event behavior | `src/features/backoffice/EventsPage.tsx` | `src/services/backoffice-events`, `src/lib/api/sse.ts`, and `src/stores/live-events.store.ts` |
| Change shared table, card, dialog, or form behavior | `src/components/ui` | [design-system.md](./design-system.md), `src/styles/globals.css`, and the affected feature tests |
| Change visual tokens or theming | `src/styles/tokens.css` | `src/styles/globals.css`, `src/hooks/useTheme.tsx`, and `src/components/shell/ThemeToggle.tsx` |
| Change selector-building UX | `src/components/selectors/SelectorBuilder.tsx` | `src/features/selectors`, `src/features/properties`, or `src/features/backoffice` depending on ownership |

## Design Principles To Preserve In Code

- Keep server state in TanStack Query. Do not mirror backend-owned collections in Zustand.
- Use URL search params for filters or view state that should survive refresh or deep linking.
- Keep feature folders responsible for workflow composition; keep service folders responsible for backend contracts.
- Reuse shared UI primitives before introducing route-specific markup or CSS patterns.
- Treat status, timestamps, and destructive actions as operational information, not decoration.
- Keep helper copy outside form labels and connect it with `aria-describedby` so accessible names stay stable.

## Doc Sync Rule

Update this file and [architecture.md](./architecture.md) in the same change when you add, remove, or re-scope:

- a mounted route
- a shell navigation section
- a service capability
- a cross-cutting UI primitive or design rule