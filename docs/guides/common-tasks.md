# Common Tasks

## Purpose

This document gives short, practical paths for the most common repository tasks.

## Context

New developers usually need to run the system, trace a workflow, and locate the correct files before making changes.

## Core Concepts

- Use the root docs for orientation.
- Use `/server/docs` for backend ownership and contracts.
- Use `/app/docs` for UI ownership and state rules.
- Use `/docs/app` for user-facing behavior and tutorials.

## Behavior / Flow

### Run the workspace
1. Follow [Quick Start](../getting-started/quick-start.md).
2. Log in with the default local admin.
3. Open Properties, Sources, Fields, Analytics, and Admin to confirm the main flows.

### Trace a frontend route
1. Read [app/docs/ui-architecture.md](../../app/docs/ui-architecture.md).
2. Open `app/src/app/router.tsx`.
3. Follow the route into `app/src/features/<feature>`.
4. Follow data dependencies into `app/src/services/<capability>`.

### Trace a backend endpoint
1. Read [server/docs/api-contracts.md](../../server/docs/api-contracts.md).
2. Open the matching `server/internal/*/transport/httpapi` handler.
3. Follow the call into the owning application service.
4. Check the store or scheduler boundary if persistence or background behavior is involved.

### Update a user workflow
1. Update the implementation.
2. Update the matching internal docs in `/server/docs` or `/app/docs`.
3. Update the user-facing page in `/docs/app/tutorials` or `/docs/app/features`.

## Examples

Examples of where to start:

- Property creation: [docs/app/tutorials/creating-a-property.md](../app/tutorials/creating-a-property.md)
- Field mapping: [docs/app/tutorials/configuring-fields.md](../app/tutorials/configuring-fields.md)
- Analytics behavior: [app/docs/features/analytics.md](../../app/docs/features/analytics.md)
- Source template contracts: [server/docs/api-contracts.md](../../server/docs/api-contracts.md)

## Related Docs

- [Developer Workflow](./developer-workflow.md)
- [Quick Start](../getting-started/quick-start.md)
- [Server Docs / Modules](../../server/docs/modules.md)
- [App Docs / UI Architecture](../../app/docs/ui-architecture.md)
- [Docs App / Overview](../app/overview.md)
