# Local Development Runbook

## Purpose

This runbook helps maintainers and feature developers start the backend quickly, verify the mounted runtime, and understand which environment variables actually shape local behavior.

Use [design-patterns.md](./design-patterns.md) for stable implementation rules, [architecture.md](./architecture.md) for runtime boundaries, and [maintenance.md](./maintenance.md) for day-2 change procedures.

## Use This When

Read this when you need to:

- start a new local backend session
- smoke-test the mounted API surface
- check which configuration is active versus parsed-only
- run focused validation after a backend change

## Fastest Start

From the repository root, this is enough for a local backend session:

```bash
mkdir -p .sqlite
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server
```

That path already:

- uses SQLite by default
- runs migrations automatically
- creates the bootstrap admin automatically
- starts the property scheduler automatically
- starts the platform-ops background service automatically

Default login after startup:

```text
email: admin@local
password: dev-password
```

## Daily Commands

From the repository root:

```bash
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server migrate
GOTOOLCHAIN=local ./third-party/go/bin/go -C server test ./internal/app
GOTOOLCHAIN=local ./third-party/go/bin/go -C server test ./internal/ingestion/application
GOTOOLCHAIN=local ./third-party/go/bin/go -C server test ./...
```

Use a package-local test target first when narrowing a change. Save `./...` for confirmation.

## Tooling And Helpers

The repository already bundles the required binaries:

- Go toolchain: `./third-party/go/bin/go`
- Garage binary: `./third-party/garage/garage`

Garage is not required for the currently mounted runtime slice. The object-store package remains in the repository, but `internal/app/runtime.go` does not currently compose it.

Useful helper scripts from the repository root:

```bash
./cmd/sqlite.sh migrate
./cmd/sqlite.sh tables
./cmd/garage.sh status
```

## Verification

```bash
BASE_URL="http://127.0.0.1:8080"

curl "${BASE_URL}/api/v1/health/live"
curl "${BASE_URL}/api/v1/health/ready"

TOKEN=$(curl -s -X POST "${BASE_URL}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local","password":"dev-password"}' | jq -r '.token')

SOURCE_ID=$(curl -s -X POST "${BASE_URL}/api/v1/backoffice/sources" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "local-template",
    "name": "Local Template",
    "kind": "html-listings",
    "config_json": "[{\"name\":\"price\",\"selectors\":[\".price\"],\"required\":true}]"
  }' | jq -r '.item.id')

PROPERTY_ID=$(curl -s -X POST "${BASE_URL}/api/v1/backoffice/properties" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"source_id\":\"${SOURCE_ID}\",\"url\":\"https://example.test/property/123\",\"label\":\"Smoke test property\"}" | jq -r '.item.id')

curl -X POST "${BASE_URL}/api/v1/backoffice/properties/${PROPERTY_ID}/ingest" \
  -H "Authorization: Bearer ${TOKEN}"

curl "${BASE_URL}/api/v1/backoffice/properties/${PROPERTY_ID}/snapshots" \
  -H "Authorization: Bearer ${TOKEN}"

curl "${BASE_URL}/api/v1/backoffice/fields" \
  -H "Authorization: Bearer ${TOKEN}"

curl "${BASE_URL}/api/v1/backoffice/platform/summary" \
  -H "Authorization: Bearer ${TOKEN}"
```

Notes:

- Backoffice routes require bearer auth.
- Source CRUD is mounted, but source-level ingest is not. Manual ingest happens at the property level.
- The global `/api/v1/backoffice/runs` endpoint returns stored snapshots. `/api/v1/backoffice/properties/{propertyID}/runs` returns scheduler attempt history.

## Mounted API Surface At A Glance

| Area | Example routes | Notes |
| --- | --- | --- |
| Health | `/api/v1/health/live`, `/api/v1/health/ready` | No auth required |
| Auth | `/api/v1/auth/login`, `/api/v1/auth/me` | Login returns bearer token |
| Engagement | `/api/v1/me/bookmarks`, `/api/v1/me/alert-rules`, `/api/v1/me/notifications` | Bearer auth required |
| Sources, events, global runs | `/api/v1/backoffice/sources`, `/api/v1/backoffice/events`, `/api/v1/backoffice/runs` | Bearer auth required |
| Properties | `/api/v1/backoffice/properties`, `/api/v1/backoffice/properties/{id}/ingest` | Core tracked-property workflow |
| Fields and analytics | `/api/v1/backoffice/fields`, `/api/v1/backoffice/fields/unmapped`, `/api/v1/backoffice/analytics/dataset` | Used for normalized field management |
| Tags | `/api/v1/backoffice/tags`, `/api/v1/backoffice/properties/{id}/tags` | Property labeling workflow |
| Platform ops | `/api/v1/backoffice/platform/settings`, `/api/v1/backoffice/platform/summary` | Outbound integration and operational visibility |

## Environment

No environment variables are required for a first run. `internal/platform/config/config.go` is the source of truth for parsing and defaults.

### Common overrides used immediately

```bash
export HS_HTTP_ADDR=":8080"
export HS_DATABASE_PATH="./.sqlite/home-searcher.db"
export HS_BOOTSTRAP_ADMIN_EMAIL="admin@local"
export HS_BOOTSTRAP_ADMIN_NAME="Local Admin"
export HS_BOOTSTRAP_ADMIN_PASSWORD="dev-password"
export HS_AUTH_SESSION_TTL="24h"
```

### Active runtime controls

```bash
export HS_SCHEDULER_TICK_INTERVAL="15s"
export HS_SCHEDULER_LOCK_TTL="2m"
export HS_SCHEDULER_SHUTDOWN_TIMEOUT="30s"
export HS_FETCHER_TIMEOUT="20s"
export HS_FETCHER_MIN_REQUEST_GAP="750ms"
export HS_FETCHER_BREAKER_INTERVAL="30s"
export HS_FETCHER_BREAKER_TIMEOUT="15s"
export HS_FETCHER_TLS_PROFILE="chrome-2026"
export HS_BROWSER_COMMAND="/usr/bin/chromium"
export HS_BROWSER_ARGS="--headless --disable-gpu --dump-dom"
export HS_BROWSER_TIMEOUT="20s"
export HS_NOTIFICATION_WEBHOOK_URL="http://127.0.0.1:9098/hooks/notifications"
export HS_SMTP_HOST="127.0.0.1"
export HS_SMTP_PORT="1025"
export HS_SMTP_FROM="home-searcher@example.test"
```

Notes:

- `HS_BROWSER_ARGS` accepts either a shell-style space-separated string or a comma-separated list.
- The runtime also accepts the legacy `HS_NOTIFICATIONS_WEBHOOK_URL` alias.

### Parsed today but not fully wired end to end

These settings exist in `platform/config`, but the active composition root does not currently turn them into mounted runtime behavior:

```bash
export HS_OBJECT_STORE_DRIVER="s3"
export HS_S3_ENDPOINT="http://127.0.0.1:5500"
export HS_S3_REGION="garage"
export HS_S3_BUCKET="home-searcher"
export HS_BOOTSTRAP_SOURCE_URL="http://127.0.0.1:9099/feed.json"
export HS_SCHEDULER_ENABLED="false"
export HS_SCHEDULER_BATCH_SIZE="10"
```

Do not expect object storage, bootstrap source registration, or scheduler disabling to change the running system unless `internal/app/runtime.go` is updated to consume those settings.

## Route Availability Notes

- The `catalog` package still exists in the repository, but `/api/v1/listings*` is not mounted by the current runtime.
- Source CRUD is mounted, but a source ingest endpoint is not.
- Object-store configuration is parsed, but the active runtime does not instantiate an object store.
- Bootstrap source configuration is parsed, but the current runtime does not auto-register a source from it.

Use [architecture.md](./architecture.md) to understand why those boundaries exist, [design-patterns.md](./design-patterns.md) for the stable implementation rules behind them, and [maintenance.md](./maintenance.md) when changing them.
