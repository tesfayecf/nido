# Common Tasks

## Run the workspace

1. Start the backend from `server/cmd/server`
2. Start the frontend from `app`
3. Log in with the local admin
4. Confirm Properties, Sources, Fields, Analytics, and Settings load

## Add a feature

1. Find the owning route or endpoint first
2. Keep transport thin and put behavior in the owning service or page
3. Reuse the existing store and service modules instead of adding new layers
4. Update the closest backend or frontend doc that owns the behavior
5. Run the existing validation commands

### Frontend entry points

- routes: `app/src/app/router.tsx`
- pages: `app/src/features/*`
- API clients: `app/src/services/*`
- shared UI: `app/src/components/*`

### Backend entry points

- mounted runtime: `server/internal/app/runtime.go`
- handlers: `server/internal/*/transport/httpapi`
- business logic: `server/internal/*/application`
- persistence: `server/internal/platform/sqlite`

## Modify existing logic

1. Start from the mounted page or handler
2. Follow one call chain at a time until you reach the owner of the rule
3. Change the smallest owner that can explain the behavior by itself
4. Avoid adding wrappers, adapters, or generic helpers unless the current code is duplicated and hard to read
5. Re-run tests before moving on
