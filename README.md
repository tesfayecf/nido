# Nido

Nido is a monorepo for an authenticated property-tracking workspace with a Go backend in `/server` and a React frontend in `/app`.

## Active system

- `/server` serves auth, tracked-property, field, tag, engagement, analytics, and platform APIs
- `/app` renders the operator UI and talks to the backend through typed service modules
- SQLite is the system of record
- The active backend runtime starts in `server/internal/app/runtime.go`
- The active frontend route tree starts in `app/src/app/router.tsx`

## Workspace layout

- `/app` — React 19 + Vite client
- `/server` — Go backend and SQLite persistence
- `/cmd` — local helper scripts
- `/docs` — onboarding, architecture, and workflow docs
- `/config` — local configuration

## Quick start

### Backend

```bash
go run /home/runner/work/nido/nido/server/cmd/server
```

Default local admin:

```text
email: admin@local
password: dev-password
```

### Frontend

```bash
cd /home/runner/work/nido/nido/app
corepack pnpm install
corepack pnpm dev
```

The frontend runs on `http://127.0.0.1:3000` and proxies `/api` to `http://127.0.0.1:8080`.

### Unified helper

```bash
/home/runner/work/nido/nido/cmd/nido.sh help
/home/runner/work/nido/nido/cmd/nido.sh seed
/home/runner/work/nido/nido/cmd/nido.sh app-start
```

## Validation

Frontend:

```bash
cd /home/runner/work/nido/nido/app
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm exec vite build
```

Backend:

```bash
cd /home/runner/work/nido/nido/server
go test ./...
```

## Developer docs

Start here:

1. [Documentation hub](./docs/README.md)
2. [System overview](./docs/getting-started/system-overview.md)
3. [Common tasks](./docs/guides/common-tasks.md)
4. [Backend overview](./server/docs/overview.md)
5. [Frontend overview](./app/docs/overview.md)
