# Local Development Runbook

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

Default login after startup:

```text
email: admin@local
password: dev-password
```

## Tooling

The repository already bundles the required binaries.

- Go toolchain: `./third-party/go/bin/go`
- Garage binary: `./third-party/garage/garage`

Garage is not required for the current runtime slice. The object-store package remains in the repository, but `internal/app/runtime.go` does not currently compose it.

## Environment

No environment variables are required for a first run.

### Common overrides

```bash
export HS_HTTP_ADDR=":8080"
export HS_DATABASE_PATH="./.sqlite/home-searcher.db"
export HS_BOOTSTRAP_ADMIN_EMAIL="admin@local"
export HS_BOOTSTRAP_ADMIN_PASSWORD="dev-password"
export HS_AUTH_SESSION_TTL="24h"
```

### Scheduler and fetcher controls used by the current runtime

```bash
export HS_SCHEDULER_TICK_INTERVAL="15s"
export HS_SCHEDULER_SHUTDOWN_TIMEOUT="30s"
export HS_FETCHER_TIMEOUT="20s"
export HS_FETCHER_MIN_REQUEST_GAP="750ms"
export HS_FETCHER_BREAKER_INTERVAL="30s"
export HS_FETCHER_BREAKER_TIMEOUT="15s"
export HS_FETCHER_TLS_PROFILE="chrome-2026"
```

### Optional browser-backed fetches

```bash
export HS_BROWSER_COMMAND="/usr/bin/chromium"
export HS_BROWSER_ARGS="--headless --disable-gpu --dump-dom"
export HS_BROWSER_TIMEOUT="20s"
```

`HS_BROWSER_ARGS` accepts either a shell-style space-separated string or a comma-separated list.

### Optional outbound notifications

```bash
export HS_NOTIFICATION_WEBHOOK_URL="http://127.0.0.1:9098/hooks/notifications"
```

The runtime also accepts the older `HS_NOTIFICATIONS_WEBHOOK_URL` alias.

### Parsed today but not meaningfully wired into the current runtime

These settings exist in `platform/config`, but the active composition root does not currently turn them into end-to-end behavior:

```bash
export HS_OBJECT_STORE_DRIVER="s3"
export HS_S3_ENDPOINT="http://127.0.0.1:5500"
export HS_BOOTSTRAP_SOURCE_URL="http://127.0.0.1:9099/feed.json"
export HS_SCHEDULER_ENABLED="true"
export HS_SCHEDULER_BATCH_SIZE="10"
```

That means you should not expect object storage, bootstrap source registration, or scheduler disabling to change the running system unless `internal/app/runtime.go` is updated.

## Local Helpers

From the repository root:

```bash
./cmd/sqlite.sh migrate
./cmd/sqlite.sh tables
./cmd/garage.sh status
```

The Garage helpers are still useful for future object-store work, but they are not required for the currently mounted backend slice.

## Start And Migrate

Start the server:

```bash
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server
```

Run migrations only:

```bash
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server migrate
```

## Health Checks

```bash
curl http://127.0.0.1:8080/api/v1/health/live
curl http://127.0.0.1:8080/api/v1/health/ready
```

## Authentication

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local","password":"dev-password"}' | jq -r '.token')

curl http://127.0.0.1:8080/api/v1/auth/me \
  -H "Authorization: Bearer ${TOKEN}"
```

## Mounted API Examples

### Sources

```bash
curl http://127.0.0.1:8080/api/v1/backoffice/sources \
  -H "Authorization: Bearer ${TOKEN}"

curl -X POST http://127.0.0.1:8080/api/v1/backoffice/sources \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "idealista-girones",
    "name": "Idealista Girones",
    "kind": "html-listings",
    "endpoint_url": "https://www.idealista.com/example-search",
    "active": true,
    "browser_enabled": true,
    "config_json": "{\"item_selector\":\"article.item\",\"title_selector\":\"a.item-link\",\"url_selector\":\"a.item-link\",\"price_selector\":\".item-price\"}"
  }'
```

Source-level ingest is not mounted in the current runtime. Manual ingest happens at the property level.

### Properties

```bash
PROPERTY_ID=$(curl -s -X POST http://127.0.0.1:8080/api/v1/backoffice/properties \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.test/property/123",
    "label": "Main tracker",
    "source_id": "idealista-girones",
    "schedule_interval_seconds": 3600,
    "retry_max_attempts": 3,
    "retry_backoff_millis": 1500
  }' | jq -r '.item.id')

curl http://127.0.0.1:8080/api/v1/backoffice/properties/${PROPERTY_ID} \
  -H "Authorization: Bearer ${TOKEN}"

curl -X POST http://127.0.0.1:8080/api/v1/backoffice/properties/${PROPERTY_ID}/config \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "fields": [
      {
        "name": "price",
        "selector_type": "css",
        "selector_value": ".price",
        "fallback_selectors": [".price-value"],
        "extraction_mode": "text",
        "text_mode": "textContent",
        "transform": "number",
        "required": true
      }
    ]
  }'

curl -X POST http://127.0.0.1:8080/api/v1/backoffice/properties/preview \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.test/property/123",
    "fields": [
      {
        "name": "price",
        "selector_type": "css",
        "selector_value": ".price",
        "extraction_mode": "text",
        "required": true
      }
    ]
  }'

curl -X POST http://127.0.0.1:8080/api/v1/backoffice/properties/${PROPERTY_ID}/ingest \
  -H "Authorization: Bearer ${TOKEN}"

curl http://127.0.0.1:8080/api/v1/backoffice/properties/${PROPERTY_ID}/snapshots?limit=10 \
  -H "Authorization: Bearer ${TOKEN}"

curl http://127.0.0.1:8080/api/v1/backoffice/properties/${PROPERTY_ID}/runs?limit=10 \
  -H "Authorization: Bearer ${TOKEN}"
```

### Global Runs And Events

```bash
curl http://127.0.0.1:8080/api/v1/backoffice/runs?limit=25 \
  -H "Authorization: Bearer ${TOKEN}"

curl http://127.0.0.1:8080/api/v1/backoffice/events \
  -H "Authorization: Bearer ${TOKEN}"
```

`/api/v1/backoffice/runs` returns stored property snapshots. `/api/v1/backoffice/properties/{propertyID}/runs` returns scheduler attempt history.

### Tags

```bash
TAG_ID=$(curl -s -X POST http://127.0.0.1:8080/api/v1/backoffice/tags \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"priority","color":"#d14b3d"}' | jq -r '.item.id')

curl -X PUT http://127.0.0.1:8080/api/v1/backoffice/properties/${PROPERTY_ID}/tags \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"tag_ids\":[\"${TAG_ID}\"]}"
```

### Engagement

```bash
curl -X POST http://127.0.0.1:8080/api/v1/me/bookmarks \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"property_id\":\"${PROPERTY_ID}\"}"

curl -X POST http://127.0.0.1:8080/api/v1/me/alert-rules \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"property_id\":\"${PROPERTY_ID}\",\"rule_type\":\"price_drop\"}"

curl http://127.0.0.1:8080/api/v1/me/notifications?unread_only=true\&limit=20 \
  -H "Authorization: Bearer ${TOKEN}"
```

## Route Availability Notes

- The `catalog` package still exists in the repository, but `/api/v1/listings*` is not mounted by the current runtime.
- Source CRUD is mounted, but a source ingest endpoint is not.
- Object-store configuration is parsed, but the active runtime does not instantiate an object store.
- Bootstrap source configuration is parsed, but the current runtime does not auto-register a source from it.

Use [architecture.md](./architecture.md) and [maintenance.md](./maintenance.md) when changing any of those boundaries.
