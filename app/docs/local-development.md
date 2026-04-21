# Frontend Local Development

## Requirements

- Node `>=22.14.0`
- pnpm `10.6.1`
- a running backend on `http://127.0.0.1:8080`

The frontend depends on the backend for auth, listings, engagement flows, and backoffice data. Start the backend first by following [server/docs/local-development.md](/home/tesfa/Finance/tools/home-searcher/server/docs/local-development.md).

## Install Dependencies

From `/app`:

```bash
pnpm install
```

## Run The Dev Server

From `/app`:

```bash
pnpm dev
```

The Vite dev server runs on `http://127.0.0.1:3000`.

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
pnpm build
pnpm lint
```

## Notes

- The frontend uses TanStack Query for all backend reads and mutations.
- Authenticated routes are expiry-aware and clear protected client state when the session is no longer valid.
- Backoffice live events use an authenticated fetch-based SSE client because native `EventSource` cannot send bearer headers.