# App Documentation Index

## Purpose

This folder documents the current frontend as an authenticated tracked-property operations console. Start here instead of reading files ad hoc.

## Recommended Reading Order

1. [codebase-map.md](./codebase-map.md)
2. [architecture.md](./architecture.md)
3. [design-system.md](./design-system.md)
4. [UI_UX_SPEC.md](./UI_UX_SPEC.md)
5. [backend-contract.md](./backend-contract.md)
6. [local-development.md](./local-development.md)
7. [maintenance.md](./maintenance.md)
8. [iterations.md](./iterations.md)

## Fast Entry Points

| If you need to understand... | Read this first | Then read |
| --- | --- | --- |
| Where code lives and which folder owns a change | [codebase-map.md](./codebase-map.md) | [architecture.md](./architecture.md) |
| Runtime boundaries, routes, and state flow | [architecture.md](./architecture.md) | [maintenance.md](./maintenance.md) |
| UI implementation rules and reusable primitives | [design-system.md](./design-system.md) | [UI_UX_SPEC.md](./UI_UX_SPEC.md) |
| Backend routes, DTOs, and payload expectations | [backend-contract.md](./backend-contract.md) | [architecture.md](./architecture.md) |
| Local setup and verification commands | [local-development.md](./local-development.md) | [maintenance.md](./maintenance.md) |
| Day-2 change procedures and debugging | [maintenance.md](./maintenance.md) | [codebase-map.md](./codebase-map.md) |

## Document Map

| File | Use it for |
| --- | --- |
| [codebase-map.md](./codebase-map.md) | Fast maintainer map of folders, routes, service patterns, and common change paths |
| [architecture.md](./architecture.md) | Frontend runtime shape, boundaries, route ownership, and state strategy |
| [backend-contract.md](./backend-contract.md) | Backend routes, DTOs, event names, and contract caveats the frontend must respect |
| [local-development.md](./local-development.md) | Running, building, testing, and connecting the app locally |
| [maintenance.md](./maintenance.md) | Day-2 change guidance, state decisions, accessibility expectations, and debugging checklists |
| [design-system.md](./design-system.md) | Reusable visual primitives plus implementation-level design rules |
| [iterations.md](./iterations.md) | Current roadmap and implemented frontend slices |
| [UI_UX_SPEC.md](./UI_UX_SPEC.md) | Route-level UX expectations, interaction goals, and product posture |
| [roadmaps/phase-1-daily-operator-efficiency.md](./roadmaps/phase-1-daily-operator-efficiency.md) | Product roadmap for dashboard, triage, bulk actions, and operator speed |
| [roadmaps/phase-2-decision-support-and-safe-automation.md](./roadmaps/phase-2-decision-support-and-safe-automation.md) | Product roadmap for alerting, change intelligence, config safety, and guided automation |
| [roadmaps/phase-3-collaboration-and-platform-expansion.md](./roadmaps/phase-3-collaboration-and-platform-expansion.md) | Product roadmap for team workflows, analytics, integrations, and platform growth |
| [screenshots/](./screenshots/) | Visual reference artifacts from earlier iterations |

## Maintenance Rule

If a route, backend DTO, service boundary, shell navigation section, or design rule changes, update this folder in the same change. Frontend docs are only useful if they describe the mounted runtime and the code developers actually touch.