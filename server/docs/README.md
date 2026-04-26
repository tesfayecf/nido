# Server Documentation Index

## Purpose

This folder documents the Go backend in `/server` for two audiences:

- maintainers who need to understand the mounted runtime, active dependencies, and operational boundaries
- feature developers who need to change handlers, services, persistence, or scheduler behavior without confusing repo shape with runtime guarantees

The repository still contains dormant and future-facing packages. These docs describe the running system first and call dormant surfaces out explicitly.

## Shared Document Structure

The app and server doc sets now use the same core structure so developers can move between layers with the same navigation model:

| Document type | What it answers |
| --- | --- |
| `README.md` | Where to start and which documents to read next |
| [codebase-map.md](./codebase-map.md) | Which folders and files own a change |
| [architecture.md](./architecture.md) | What runtime is mounted and which boundaries matter |
| [design-patterns.md](./design-patterns.md) | Which implementation patterns should survive the next change |
| [local-development.md](./local-development.md) | How to run, verify, and configure the backend locally |
| [maintenance.md](./maintenance.md) | How to route changes, debug regressions, and keep docs in sync |
| [iterations.md](./iterations.md) | What has shipped, what is planned, and what remains dormant or future-facing |

## Recommended Reading Paths

### New maintainer

1. [codebase-map.md](./codebase-map.md)
2. [architecture.md](./architecture.md)
3. [design-patterns.md](./design-patterns.md)
4. [local-development.md](./local-development.md)
5. [maintenance.md](./maintenance.md)
6. [iterations.md](./iterations.md)

### Feature developer

1. [codebase-map.md](./codebase-map.md)
2. [design-patterns.md](./design-patterns.md)
3. [architecture.md](./architecture.md)
4. [local-development.md](./local-development.md)
5. [maintenance.md](./maintenance.md)

### Debugging or incident response

1. [maintenance.md](./maintenance.md)
2. [architecture.md](./architecture.md)
3. [codebase-map.md](./codebase-map.md)
4. [local-development.md](./local-development.md)

## Document Map

| File | Use it for |
| --- | --- |
| [codebase-map.md](./codebase-map.md) | Fast file-by-file navigation guide for backend packages, tests, and dormant surfaces |
| [architecture.md](./architecture.md) | Mounted runtime shape, request and ingest flows, and the architectural guardrails behind the current design |
| [design-patterns.md](./design-patterns.md) | Stable backend implementation patterns for transport, services, persistence, scheduler, config, and events |
| [local-development.md](./local-development.md) | Server startup, smoke tests, active environment variables, and mounted route examples |
| [maintenance.md](./maintenance.md) | Change-routing guide, debugging checklists, focused validation strategy, and doc update rules |
| [iterations.md](./iterations.md) | Historical and planned backend slices, clearly separated from current runtime guarantees |

## Runtime Truth Sources

When docs and code disagree, these files win:

- `cmd/server/main.go`: process commands, HTTP server lifecycle, graceful shutdown
- `internal/app/runtime.go`: active dependency graph, mounted route groups, health endpoints, scheduler startup, and middleware stack
- `internal/platform/config/config.go`: environment contract and defaults
- `internal/app/runtime_test.go`: end-to-end tests proving the mounted slice

## Maintenance Rule

Update these docs in the same change whenever you modify any of the following:

- mounted routes or middleware
- config consumption in `internal/app/runtime.go`
- scheduler lifecycle or concurrency defaults
- the boundary between active and dormant backend packages

If you add a new server doc, keep the same opening structure used by the shared core docs whenever it fits:

1. purpose or audience
2. when to read the document
3. ownership or runtime truth
4. stable patterns to preserve
5. update or validation expectations

The repo shape is intentionally broader than the mounted runtime. Silent drift here is the fastest way to confuse new maintainers.