# Introduction

## Purpose

This document starts the onboarding flow for new developers and agents. It explains what Nido is and points to the exact next documents to read.

## Context

The repository contains a Go backend, a React frontend, and a documentation system split into three layers:

- `/docs` for cross-repository onboarding and shared concepts
- `/server/docs` for backend responsibilities and contracts
- `/app/docs` for frontend structure and UX implementation details

## Core Concepts

- Nido is an authenticated operations workspace, not a public consumer site.
- The main workflow centers on source templates, tracked properties, snapshots, scheduler runs, analytics, alerts, and notifications.
- `runtime.go` and `router.tsx` define the active backend and frontend surfaces.
- This onboarding flow is explicit and linear.

## Behavior / Flow

Read these documents in order:

1. **Introduction** — this document
2. [System Overview](./system-overview.md) — high-level repository and product model
3. [Quick Start](./quick-start.md) — run the app and backend locally
4. [System Design](../architecture/system-design.md) — shared architecture decisions
5. [Developer Workflow](../guides/developer-workflow.md) — change and validation expectations

After that:

- go to [server/docs/overview.md](../../server/docs/overview.md) for backend internals
- go to [app/docs/overview.md](../../app/docs/overview.md) for frontend internals
- go to [docs/app/overview.md](../app/overview.md) for end-user documentation

## Examples

Example onboarding path for a frontend maintainer:

1. Read [System Overview](./system-overview.md)
2. Run the workspace from [Quick Start](./quick-start.md)
3. Read [app/docs/ui-architecture.md](../../app/docs/ui-architecture.md)
4. Read [app/docs/state-management.md](../../app/docs/state-management.md)

## Related Docs

- [System Overview](./system-overview.md)
- [Quick Start](./quick-start.md)
- [Architecture / System Design](../architecture/system-design.md)
- [Guides / Developer Workflow](../guides/developer-workflow.md)
- [Server Docs / Overview](../../server/docs/overview.md)
- [App Docs / Overview](../../app/docs/overview.md)
