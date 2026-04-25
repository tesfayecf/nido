# Server Documentation Index

## Purpose

This folder is the maintainer-facing map for the Go backend in `/server`. Use it to answer three questions quickly before you dive into package code:

- What runtime is actually mounted today?
- Where does that behavior live in code?
- Which design rules should survive the next change?

The repository contains dormant and future-facing backend packages. These docs describe the running system first and call dormant surfaces out explicitly so maintainers do not confuse repo shape with runtime guarantees.

## Recommended Reading Paths

### New maintainer

1. [codebase-map.md](./codebase-map.md)
2. [architecture.md](./architecture.md)
3. [local-development.md](./local-development.md)
4. [maintenance.md](./maintenance.md)
5. [iterations.md](./iterations.md)

### Feature developer

1. [codebase-map.md](./codebase-map.md)
2. [local-development.md](./local-development.md)
3. [maintenance.md](./maintenance.md)

### Debugging or incident response

1. [maintenance.md](./maintenance.md)
2. [codebase-map.md](./codebase-map.md)
3. [architecture.md](./architecture.md)

## Document Map

| File | Use it for |
| --- | --- |
| [codebase-map.md](./codebase-map.md) | Fast file-by-file navigation guide for the backend packages, tests, and dormant surfaces |
| [architecture.md](./architecture.md) | Mounted runtime shape, request and ingest flows, and the architectural guardrails behind the current design |
| [local-development.md](./local-development.md) | Server startup, smoke tests, active environment variables, and mounted route examples |
| [maintenance.md](./maintenance.md) | Change-routing guide, debugging checklists, focused validation strategy, and doc update rules |
| [iterations.md](./iterations.md) | Historical and planned backend slices, clearly separated from current runtime guarantees |

## Runtime Truth Sources

When docs and code disagree, these files win:

- `cmd/server/main.go`: process commands, HTTP server lifecycle, graceful shutdown
- `internal/app/runtime.go`: active dependency graph, mounted route groups, health endpoints, and middleware stack
- `internal/platform/config/config.go`: environment contract and defaults
- `internal/app/runtime_test.go`: end-to-end tests proving the mounted slice

## Maintenance Rule

Update these docs in the same change whenever you modify any of the following:

- mounted routes or middleware
- config consumption in `internal/app/runtime.go`
- scheduler lifecycle or concurrency defaults
- the boundary between active and dormant backend packages

The repo shape is intentionally broader than the mounted runtime. Silent drift here is the fastest way to confuse new maintainers.