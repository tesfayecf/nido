# App Documentation Index

## Purpose

This folder documents the current frontend as an authenticated tracked-property operations console. Start here instead of reading files ad hoc.

## Recommended Reading Order

1. [architecture.md](./architecture.md)
2. [backend-contract.md](./backend-contract.md)
3. [local-development.md](./local-development.md)
4. [maintenance.md](./maintenance.md)
5. [design-system.md](./design-system.md)
6. [iterations.md](./iterations.md)
7. [UI_UX_SPEC.md](./UI_UX_SPEC.md)

## Document Map

| File | Use it for |
| --- | --- |
| [architecture.md](./architecture.md) | Frontend runtime shape, boundaries, route ownership, and state strategy |
| [backend-contract.md](./backend-contract.md) | Backend routes, DTOs, event names, and contract caveats the frontend must respect |
| [local-development.md](./local-development.md) | Running, building, testing, and connecting the app locally |
| [maintenance.md](./maintenance.md) | Day-2 change guidance, state decisions, accessibility expectations, and debugging checklists |
| [design-system.md](./design-system.md) | Reusable visual primitives and styling direction |
| [iterations.md](./iterations.md) | Current roadmap and implemented frontend slices |
| [UI_UX_SPEC.md](./UI_UX_SPEC.md) | Route-level UX expectations and the current operational product posture |
| [roadmaps/phase-1-daily-operator-efficiency.md](./roadmaps/phase-1-daily-operator-efficiency.md) | Product roadmap for dashboard, triage, bulk actions, and operator speed |
| [roadmaps/phase-2-decision-support-and-safe-automation.md](./roadmaps/phase-2-decision-support-and-safe-automation.md) | Product roadmap for alerting, change intelligence, config safety, and guided automation |
| [roadmaps/phase-3-collaboration-and-platform-expansion.md](./roadmaps/phase-3-collaboration-and-platform-expansion.md) | Product roadmap for team workflows, analytics, integrations, and platform growth |
| [screenshots/](./screenshots/) | Visual reference artifacts from earlier iterations |

## Maintenance Rule

If a backend route, DTO, or runtime priority changes, update this folder in the same change. Frontend docs are only useful if they describe the mounted runtime, not just the repository shape.