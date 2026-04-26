# Documentation Hub

## Purpose

This directory is the primary entry point for documentation across the monorepo. It gives new developers, maintainers, and automation agents one place to start before they move into backend-, frontend-, or user-focused details.

## Context

Nido is a monorepo with a Go backend in `/server` and a React frontend in `/app`. The active product is an authenticated property-tracking workspace with source templates, tracked properties, field definitions, analytics, engagement workflows, and platform settings.

## Core Concepts

- **Getting started** explains what the system is, how the pieces fit together, and how to run it.
- **Architecture** explains the stable system model, data model, and design decisions that span the whole repository.
- **Guides** explain how to work in the repository without breaking established conventions.
- **App docs** explain the user-facing product behavior, tutorials, and feature guides.
- **References** define shared terminology and writing conventions.

## Behavior / Flow

Use this navigation path unless you already know the layer you need:

1. [Getting Started / Introduction](./getting-started/introduction.md)
2. [Getting Started / System Overview](./getting-started/system-overview.md)
3. [Getting Started / Quick Start](./getting-started/quick-start.md)
4. [Architecture / System Design](./architecture/system-design.md)
5. [Guides / Developer Workflow](./guides/developer-workflow.md)
6. Layer-specific detail in [server/docs/overview.md](../server/docs/overview.md) or [app/docs/overview.md](../app/docs/overview.md)
7. End-user guidance in [App / Overview](./app/overview.md)

## Examples

Common entry points:

- New developer: start at [introduction.md](./getting-started/introduction.md)
- Backend change: move from [system-design.md](./architecture/system-design.md) to [server/docs/architecture.md](../server/docs/architecture.md)
- Frontend change: move from [system-design.md](./architecture/system-design.md) to [app/docs/ui-architecture.md](../app/docs/ui-architecture.md)
- Product walkthrough: start at [app/overview.md](./app/overview.md)

## Related Docs

- [Getting Started / Introduction](./getting-started/introduction.md)
- [Architecture / System Design](./architecture/system-design.md)
- [Guides / Developer Workflow](./guides/developer-workflow.md)
- [References / Glossary](./references/glossary.md)
- [Server Docs / Overview](../server/docs/overview.md)
- [App Docs / Overview](../app/docs/overview.md)
