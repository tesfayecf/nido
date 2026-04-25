# Home Searcher

Home Searcher is a monorepo for a housing-market workspace with a Go backend under `/server` and a React + Vite frontend under `/app`.

The current implementation focuses on:

- authenticated tracked-property operations, including extraction config, snapshots, and scheduler history
- authenticated personal tracking with bookmarks, alerts, and notifications
- authenticated backoffice operations for sources, tags, runs, and live events

The repository still contains some legacy or future-facing packages, including catalog/listing and object-store code. The active runtime documentation below calls out which surfaces are mounted today.

## Workspace Layout

- `/app` — React 19 + Vite client, TanStack Query for server state, Zustand for client state
- `/server` — Go backend, modular monolith, SQLite persistence, SSE transport for live backoffice events
- `/cmd` — helper scripts for local SQLite and Garage workflows
- `/config` — local Garage configuration
- `/docs` — prompt and planning artifacts
- `/third-party` — bundled Go and Garage binaries used by the workspace

## Quick Start

### Backend

Use the bundled Go toolchain and follow the environment contract documented in [server/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/server/docs/local-development.md).

From the repository root:

```bash
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server
```

That minimal start uses SQLite defaults and creates the local admin automatically:

```text
email: admin@local
password: dev-password
```

### Frontend

Follow the frontend runbook in [app/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/app/docs/local-development.md).

From `/app`:

```bash
pnpm install
pnpm dev
```

The frontend dev server runs on `http://127.0.0.1:3000` and proxies `/api` requests to the backend on `http://127.0.0.1:8080` by default.

### Unified Helper

If you want one root-level entrypoint for the common backend and frontend flows, use:

```bash
./cmd/home-searcher.sh help
./cmd/home-searcher.sh app-start
```

The helper exposes backend build and run commands, frontend build and preview commands, and forwards the usual `HS_*` and `VITE_*` environment variables. For example:

```bash
HS_DATABASE_PATH="./server/.sqlite/local.db" ./cmd/home-searcher.sh backend-run
APP_API_ORIGIN="http://127.0.0.1:8080" ./cmd/home-searcher.sh frontend-build
```

## Verification Commands

Frontend:

```bash
cd app
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Backend:

```bash
cd server
GOTOOLCHAIN=local ../third-party/go/bin/go test ./...
```

`GOTOOLCHAIN=local` keeps test runs pinned to the bundled workspace toolchain instead of attempting to fetch a newer Go release.

## Key Docs

- [app/docs/README.md](/home/tesfa/Finance/tools/home-searcher/app/docs/README.md)
- [server/docs/architecture.md](/home/tesfa/Finance/tools/home-searcher/server/docs/architecture.md)
- [server/docs/README.md](/home/tesfa/Finance/tools/home-searcher/server/docs/README.md)
- [server/docs/maintenance.md](/home/tesfa/Finance/tools/home-searcher/server/docs/maintenance.md)
- [server/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/server/docs/local-development.md)
- [app/docs/architecture.md](/home/tesfa/Finance/tools/home-searcher/app/docs/architecture.md)
- [app/docs/maintenance.md](/home/tesfa/Finance/tools/home-searcher/app/docs/maintenance.md)
- [app/docs/backend-contract.md](/home/tesfa/Finance/tools/home-searcher/app/docs/backend-contract.md)
- [app/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/app/docs/local-development.md)
