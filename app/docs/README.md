# App Documentation Index

## Purpose

This folder documents the current frontend as an authenticated tracked-property operations console. It is written for two audiences:

- maintainers who need to debug, extend, or verify the mounted runtime
- feature developers who need to find the right ownership boundary before editing UI, state, or transport code

## Shared Document Structure

The app and server doc sets now follow the same core structure so developers can move between them without relearning the index:

| Document type | What it answers |
| --- | --- |
| `README.md` | Where to start and which documents to read next |
| [codebase-map.md](./codebase-map.md) | Which folders and files own a change |
| [architecture.md](./architecture.md) | What runtime is mounted and which boundaries matter |
| [design-patterns.md](./design-patterns.md) | Which implementation patterns should survive the next change |
| [local-development.md](./local-development.md) | How to run, verify, and configure the app locally |
| [maintenance.md](./maintenance.md) | How to route changes, debug regressions, and keep docs in sync |
| [iterations.md](./iterations.md) | What has shipped, what is planned, and what remains future-facing |

App-only references extend that shared base:

- [design-system.md](./design-system.md) for reusable visual primitives and UI composition rules
- [backend-contract.md](./backend-contract.md) for payload and route expectations the frontend consumes
- [UI_UX_SPEC.md](./UI_UX_SPEC.md) for route-level interaction and product posture guidance

## Recommended Reading Paths

### New maintainer

1. [codebase-map.md](./codebase-map.md)
2. [architecture.md](./architecture.md)
3. [design-patterns.md](./design-patterns.md)
4. [design-system.md](./design-system.md)
5. [backend-contract.md](./backend-contract.md)
6. [local-development.md](./local-development.md)
7. [maintenance.md](./maintenance.md)
8. [iterations.md](./iterations.md)

### Feature developer

1. [codebase-map.md](./codebase-map.md)
2. [design-patterns.md](./design-patterns.md)
3. [architecture.md](./architecture.md)
4. [design-system.md](./design-system.md)
5. [backend-contract.md](./backend-contract.md)
6. [maintenance.md](./maintenance.md)

### Debugging or incident response

1. [maintenance.md](./maintenance.md)
2. [architecture.md](./architecture.md)
3. [codebase-map.md](./codebase-map.md)
4. [backend-contract.md](./backend-contract.md)

## Document Map

| File | Use it for |
| --- | --- |
| [codebase-map.md](./codebase-map.md) | Fast maintainer map of folders, routes, service patterns, and common change paths |
| [architecture.md](./architecture.md) | Frontend runtime shape, boundaries, route ownership, and state strategy |
| [design-patterns.md](./design-patterns.md) | Stable frontend implementation patterns for routes, services, state, accessibility, and shared UI |
| [design-system.md](./design-system.md) | Reusable visual primitives plus implementation-level UI rules |
| [backend-contract.md](./backend-contract.md) | Backend routes, DTOs, event names, and contract caveats the frontend must respect |
| [local-development.md](./local-development.md) | Running, building, testing, and connecting the app locally |
| [maintenance.md](./maintenance.md) | Day-2 change guidance, state decisions, accessibility expectations, and debugging checklists |
| [iterations.md](./iterations.md) | Current roadmap and implemented frontend slices |
| [UI_UX_SPEC.md](./UI_UX_SPEC.md) | Route-level UX expectations, interaction goals, and product posture |
| [roadmaps/phase-1-daily-operator-efficiency.md](./roadmaps/phase-1-daily-operator-efficiency.md) | Product roadmap for dashboard, triage, bulk actions, and operator speed |
| [roadmaps/phase-2-decision-support-and-safe-automation.md](./roadmaps/phase-2-decision-support-and-safe-automation.md) | Product roadmap for alerting, change intelligence, config safety, and guided automation |
| [roadmaps/phase-3-collaboration-and-platform-expansion.md](./roadmaps/phase-3-collaboration-and-platform-expansion.md) | Product roadmap for team workflows, analytics, integrations, and platform growth |
| [screenshots/](./screenshots/) | Visual reference artifacts from earlier iterations |

## Runtime Truth Sources

When docs and code disagree, these frontend files win first:

- `src/app/router.tsx` for mounted routes and route ownership
- `src/components/shell/navigation.ts` for authenticated shell grouping and navigation labels
- `src/app/RequireAuth.tsx` and `src/stores/session.store.ts` for auth and expiry behavior
- `src/services/*` plus `src/lib/api/client.ts` and `src/lib/api/sse.ts` for contract and transport behavior
- `src/styles/tokens.css` and `src/components/ui/*` for shared UI primitives and token usage

## Maintenance Rule

If a route, backend DTO, service boundary, shell navigation section, or design rule changes, update this folder in the same change.

If you add a new app doc, keep the same opening structure used by the shared core docs whenever it fits:

1. purpose or audience
2. when to read the document
3. ownership or runtime truth
4. stable patterns to preserve
5. update or validation expectations