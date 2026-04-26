# Frontend Local Development

## Purpose

This runbook helps maintainers and feature developers start the frontend, connect it to the backend, and run focused verification before or after a change.

Use [design-patterns.md](./design-patterns.md) for stable implementation rules, [architecture.md](./architecture.md) for runtime boundaries, and [maintenance.md](./maintenance.md) for day-2 change procedures.

## Use This When

Read this when you need to:

- start a new local frontend session
- point the app at a different backend target
- verify auth, route, or event-stream behavior
- run focused validation after a frontend change

## Requirements

- Node `>=22.14.0`
- pnpm `10.6.1`
- a running backend on `http://127.0.0.1:8080`

The frontend depends on the backend for auth, tracked-property workflows, tags, engagement flows, and backoffice data. Start the backend first by following [../../server/docs/local-development.md](../../server/docs/local-development.md).

## Fastest Start

From `/app`:

```bash
pnpm install
pnpm dev
```

The Vite dev server runs on `http://127.0.0.1:3000`.

## Daily Commands

From `/app`:

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Prefer `pnpm typecheck` and a focused test pass before broad UI rewrites.

## API Routing

During local development, requests to `/api` are proxied to `http://127.0.0.1:8080` by default.

If you need a different backend target, set:

```bash
export VITE_BACKEND_ORIGIN="http://127.0.0.1:8080"
```

For non-proxied environments or direct absolute API calls, you can also set:

```bash
export VITE_API_ORIGIN="http://127.0.0.1:8080"
```

## Default Login

When using the backend local-development defaults, sign in with:

```text
email: admin@local
password: dev-password
```

If you changed the backend bootstrap auth environment variables, use those values instead.

## Verification

From `/app`:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## Workflow Notes

- The frontend uses TanStack Query for all backend reads and mutations.
- Authenticated routes are expiry-aware and clear protected client state when the session is no longer valid.
- Backoffice live events use an authenticated fetch-based SSE client because native `EventSource` cannot send bearer headers.
- If a change affects route ownership, service modules, or shared UI primitives, update the related docs in this folder in the same change.

## Recommended Follow-Up

- [architecture.md](./architecture.md)
- [design-patterns.md](./design-patterns.md)
- [backend-contract.md](./backend-contract.md)
- [maintenance.md](./maintenance.md)