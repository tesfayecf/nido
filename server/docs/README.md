# Server Documentation Index

## Purpose

This folder documents the current mounted backend runtime. Start here before diving into package code so you can separate active behavior from dormant or future-facing repo surfaces.

## Recommended Reading Order

1. [architecture.md](./architecture.md)
2. [local-development.md](./local-development.md)
3. [maintenance.md](./maintenance.md)
4. [iterations.md](./iterations.md)

## Document Map

| File | Use it for |
| --- | --- |
| [architecture.md](./architecture.md) | Runtime composition, package boundaries, request flow, scheduler flow, and event architecture |
| [local-development.md](./local-development.md) | Startup commands, env vars, mounted API examples, and route-availability notes |
| [maintenance.md](./maintenance.md) | Day-2 changes, debugging guidance, testing strategy, and documentation discipline |
| [iterations.md](./iterations.md) | Current backend roadmap with mounted vs dormant capabilities clearly separated |

## Maintenance Rule

When `internal/app/runtime.go` changes what the server actually mounts or composes, update these docs immediately. The backend has enough dormant surfaces that silent drift will mislead new developers very quickly.