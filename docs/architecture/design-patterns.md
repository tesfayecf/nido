# Design Rules

## Do

- start from the mounted runtime files
- keep handlers and routes easy to read
- keep business rules in one owning service or page
- keep backend-to-frontend contracts explicit
- keep state local unless multiple routes truly need it
- update the nearest doc when behavior changes

## Don't

- add abstraction layers for one caller
- hide behavior behind generic factories or adapters
- split one rule across many files without a clear reason
- document inactive code as part of the product
- add global state for page-local concerns

## Current examples

- backend composition: `server/internal/app/runtime.go`
- frontend composition: `app/src/app/router.tsx`
- backend data owner: `server/internal/platform/sqlite/store.go`
- frontend server-state owner: `app/src/services/*` plus TanStack Query usage in pages
