# Developer Workflow

## Purpose

This document defines the expected workflow for changing the repository while keeping the active runtime and documentation aligned.

## Context

The repository mixes backend, frontend, and user-facing documentation. Small changes become confusing when routing, contracts, or terminology change without documentation updates.

## Core Concepts

- Start from the active runtime, not assumptions from dormant code.
- Change the nearest authoritative docs in the same work item.
- Keep backend, frontend, and user-facing docs synchronized when a workflow crosses layers.
- Reuse the shared terminology from the glossary.

## Behavior / Flow

Recommended workflow:

1. Read [Introduction](../getting-started/introduction.md) if you are new to the repository.
2. Identify the owning layer using [System Design](../architecture/system-design.md).
3. Read the relevant deep docs in `/server/docs` or `/app/docs`.
4. Make the smallest complete change in code or docs.
5. Update related documentation in the same change.
6. Run the existing validation commands:
   - `go test ./...`
   - `corepack pnpm typecheck`
   - `corepack pnpm test`
   - `corepack pnpm build`
   - `corepack pnpm lint`
7. Check relative links when documentation changes.

## Examples

Typical document pairings:

- Backend route change: update [server/docs/api-contracts.md](../../server/docs/api-contracts.md) and the matching frontend feature or component docs.
- Frontend interaction change: update [app/docs/interaction-patterns.md](../../app/docs/interaction-patterns.md) and the related user tutorial in [docs/app/tutorials](../app/tutorials).
- Shared terminology change: update [glossary.md](../references/glossary.md) and any affected feature guides.

## Related Docs

- [Guides / Common Tasks](./common-tasks.md)
- [Architecture / Design Patterns](../architecture/design-patterns.md)
- [References / Conventions](../references/conventions.md)
- [Server Docs / Overview](../../server/docs/overview.md)
- [App Docs / Overview](../../app/docs/overview.md)
