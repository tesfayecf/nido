# Quick Start

## Purpose

This document gives the minimum steps needed to run, verify, and explore the active system locally.

## Context

The backend uses Go and SQLite. The frontend uses React, Vite, TypeScript, and pnpm. The backend must be running before the frontend can complete authenticated flows.

## Core Concepts

- The backend listens on `http://127.0.0.1:8080` by default.
- The frontend listens on `http://127.0.0.1:3000` by default.
- The default local admin user is created automatically.
- Existing validation commands already cover application integrity after documentation-only changes.

## Behavior / Flow

1. Start the backend:

   ```bash
   cd /home/runner/work/nido/nido/server
   go run ./cmd/server
   ```

2. In a second shell, install and start the frontend:

   ```bash
   cd /home/runner/work/nido/nido/app
   corepack enable
   corepack pnpm install
   corepack pnpm dev
   ```

3. Sign in with the default local account:

   ```text
   email: admin@local
   password: dev-password
   ```

4. Verify the main areas load: Properties, Analytics, Sources, Runs, Fields, Alerts, Notifications, Settings, and Admin.

5. Run the existing validation commands when you need a full verification pass:

   ```bash
   cd /home/runner/work/nido/nido/app
   corepack pnpm typecheck
   corepack pnpm test
   corepack pnpm build
   corepack pnpm lint

   cd /home/runner/work/nido/nido/server
   go test ./...
   ```

## Examples

If `pnpm` is not globally installed, `corepack pnpm` is the supported fallback.

If you only need the most common workspace helper commands, use:

```bash
cd /home/runner/work/nido/nido
./cmd/nido.sh help
```

## Related Docs

- [Introduction](./introduction.md)
- [System Overview](./system-overview.md)
- [Guides / Common Tasks](../guides/common-tasks.md)
- [Server Docs / Overview](../../server/docs/overview.md)
- [App Docs / Overview](../../app/docs/overview.md)
