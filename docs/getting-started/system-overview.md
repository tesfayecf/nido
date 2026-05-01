# System Overview

Nido has one active product surface: an authenticated workspace for tracking property data, reviewing runs, and managing follow-up workflows.

## Repository map

- `/server` — backend runtime, APIs, persistence, schedulers
- `/app` — frontend routes, pages, state, API clients
- `/docs` — onboarding and architecture docs
- `/cmd` — local helper commands

## Core concepts

- **Source**: reusable extraction template
- **Property**: tracked URL plus schedule and config
- **Snapshot**: extracted field values for one run
- **Property run**: one manual or scheduled execution record
- **Field**: canonical schema entry used by normalization and analytics
- **Tag / bookmark / alert / notification**: follow-up tools layered on top of tracked properties

## Data flow

```text
browser route
  -> app/src/features/* page
  -> app/src/services/* client
  -> server/internal/*/transport/httpapi handler
  -> server/internal/*/application service
  -> server/internal/platform/sqlite store
  -> JSON response
  -> TanStack Query cache + local page state
```

## Main runtime entry points

- Backend composition: `server/internal/app/runtime.go`
- Frontend composition: `app/src/app/router.tsx`
- Frontend providers: `app/src/app/AppProviders.tsx`
- Shared backend persistence: `server/internal/platform/sqlite/store.go`

## What changed in the simplified system

- Only mounted runtime behavior is documented as product behavior
- Legacy catalog code was removed because it was not part of the active runtime
- The unused source scheduler shutdown path was removed; the active property scheduler remains
- Frontend dependencies were trimmed to the packages that are actually used
