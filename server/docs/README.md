<!--
File Name: README.md
Purpose: Provides the centralized backend documentation index.
Responsibilities:
- Link root, module, folder, file, environment, and visual documentation.
- Explain how contributors navigate backend docs at file-level granularity.
- Define the documentation update workflow for backend changes.
Inputs / Outputs: Markdown index consumed by engineers and reviewers.
Dependencies: Backend README files, architecture docs, environment guides, and source comments.
Side Effects: None.
Critical Notes: Treat this file as the first backend documentation entry point.
-->

# Backend Documentation Index

## Start here

1. [Backend root README](../README.md)
2. [Overview](./overview.md)
3. [Architecture](./architecture.md)
4. [Module inventory](./modules.md)
5. [Data-flow and workflows](./data-flow.md)
6. [API contracts](./api-contracts.md)
7. [Patterns and constraints](./patterns.md)
8. [Development environment](./environment-development.md)
9. [Production setup](./environment-production.md)
10. [Visual proof and documentation coverage](./visual-proof.md)

## Folder-level documentation

Every backend source folder has a local `README.md`. Use the folder README first, then open source files for file headers and symbol comments.

| Folder | Responsibility |
| --- | --- |
| [`cmd/server`](../cmd/server/README.md) | Process entrypoint and graceful shutdown |
| [`internal/app`](../internal/app/README.md) | Runtime composition, migrations, health, route mounting |
| [`internal/auth`](../internal/auth/README.md) | Authentication, profiles, sessions, middleware |
| [`internal/engagement`](../internal/engagement/README.md) | Bookmarks, alerts, notifications |
| [`internal/engine`](../internal/engine/README.md) | Worker pool, retry, classified errors |
| [`internal/fetcher`](../internal/fetcher/README.md) | Outbound HTTP fetching and challenge handling |
| [`internal/ingestion`](../internal/ingestion/README.md) | Sources, properties, fields, tags, analytics, scheduler |
| [`internal/parser`](../internal/parser/README.md) | Payload parsers for HTTP JSON and HTML formats |
| [`internal/platform`](../internal/platform/README.md) | Shared config, events, HTTP, IDs, object store, SQLite |
| [`internal/platformops`](../internal/platformops/README.md) | Settings, backup/restore, delivery logs, operational summaries |
| [`internal/seed`](../internal/seed/README.md) | Deterministic local/demo seed data |

## File and symbol documentation standard

Backend Go files begin with a structured header containing:

- File name
- Purpose
- Responsibilities
- Inputs / Outputs
- Dependencies
- Side effects
- Critical notes

Every top-level Go `type` and `func` has a structured documentation block containing:

- Purpose
- Parameters
- Returns
- Logic summary
- Edge cases
- Side effects where applicable

## Update workflow

1. Update source behavior.
2. Update the file header and affected function/type comments in the same change.
3. Update the nearest folder README when folder responsibility, components, or interactions change.
4. Update central docs when routes, workflows, environment variables, or risks change.
5. Run `go test ./...` from `/home/runner/work/nido/nido/server`.
