# Local Development Runbook

## Fastest Start

From the repository root, this is enough for a first local run:

```bash
mkdir -p .sqlite
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server
```

That start path already:

- uses SQLite by default
- creates the bootstrap admin user automatically
- runs SQLite migrations automatically
- skips the bootstrap feed unless you explicitly configure one

Default login after startup:

```text
email: admin@local
password: dev-password
```

## Tooling

The repository already bundles the required binaries.

- Go toolchain: `./third-party/go/bin/go`
- Garage binary: `./third-party/garage/garage`

The workspace root also configures VS Code to use the bundled Go runtime.

## Environment

The server reads configuration from environment variables, but none are required for the first local start.

### Optional local overrides

```bash
export HS_HTTP_ADDR=":8080"
export HS_DATABASE_PATH="./.sqlite/home-searcher.db"
export HS_BOOTSTRAP_ADMIN_EMAIL="admin@local"
export HS_BOOTSTRAP_ADMIN_PASSWORD="dev-password"
```

### Optional bootstrap JSON feed

Set this only when you want the server to auto-register a local source at startup.

```bash
export HS_BOOTSTRAP_SOURCE_URL="http://127.0.0.1:9099/feed.json"
```

### Optional runtime overrides

```bash
export HS_OBJECT_STORE_DRIVER="memory"
export HS_BOOTSTRAP_SOURCE_KIND="http-json-feed"
export HS_BOOTSTRAP_SOURCE_SCHEDULE_INTERVAL="60s"
export HS_BOOTSTRAP_SOURCE_RETRY_MAX_ATTEMPTS="2"
export HS_BOOTSTRAP_SOURCE_RETRY_BACKOFF="1500ms"
export HS_FETCHER_MIN_REQUEST_GAP="750ms"
export HS_BOOTSTRAP_SOURCE_RATE_LIMIT_WINDOW="60s"
export HS_BOOTSTRAP_SOURCE_RATE_LIMIT_MAX_REQUESTS="5"
export HS_SCHEDULER_ENABLED="true"
export HS_SCHEDULER_TICK_INTERVAL="15s"
```

### Garage-backed object storage

When you want to use Garage instead of the in-memory store:

```bash
export HS_OBJECT_STORE_DRIVER="s3"
export HS_S3_ENDPOINT="http://127.0.0.1:5500"
export HS_S3_REGION="local"
export HS_S3_BUCKET="hs-dev"
export HS_S3_ACCESS_KEY_ID="<garage-access-key>"
export HS_S3_SECRET_ACCESS_KEY="<garage-secret-key>"
export HS_S3_KEY_PREFIX="home-searcher/dev"
```

### Optional browser-backed source fetches

For `html-jsonld` sources that require JavaScript execution, set a browser command.

```bash
export HS_BROWSER_COMMAND="/usr/bin/chromium"
export HS_BROWSER_ARGS="--headless --disable-gpu --dump-dom"
export HS_BROWSER_TIMEOUT="20s"
```

`HS_BROWSER_ARGS` accepts either a shell-style space-separated string or a comma-separated list.

Portal search presets such as Idealista, Fotocasa, and Habitaclia should usually run with `browser_enabled=true`, so configure `HS_BROWSER_COMMAND` before ingesting those sources.

When `HS_BROWSER_COMMAND` is configured, the shared fetcher now starts with a browser-like HTTP request and only escalates to browser rendering when the response matches a known anti-bot challenge page. The fetcher also keeps a shared cookie jar and enforces a small per-domain request gap to reduce repetitive request fingerprints.

For property trackers that only load correctly in your browser session, the property create and preview APIs also accept `request_headers` so you can replay cookies or a user-agent for a specific listing URL.

### Optional outbound notifications

```bash
export HS_NOTIFICATION_WEBHOOK_URL="http://127.0.0.1:9098/hooks/notifications"
```

For compatibility, the runtime also accepts the older `HS_NOTIFICATIONS_WEBHOOK_URL` name.

## Local Helpers

From the repository root:

```bash
./cmd/sqlite.sh migrate
./cmd/sqlite.sh tables
./cmd/garage.sh status
./cmd/garage.sh start
```

## Start The Server

From the repository root:

```bash
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server
```

Or migrate the SQLite schema only:

```bash
GOTOOLCHAIN=local ./third-party/go/bin/go -C server run ./cmd/server migrate
```

You only need the explicit migrate command when you want to prepare the database without starting the HTTP server. Normal startup already runs migrations.

## Health Endpoints

```bash
curl http://127.0.0.1:8080/api/v1/health/live
curl http://127.0.0.1:8080/api/v1/health/ready
```

## Authentication

The backoffice and user endpoints require a bearer token. The bootstrap admin is created at startup from the auth environment variables above.

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local","password":"dev-password"}' | jq -r '.token')

curl http://127.0.0.1:8080/api/v1/auth/me \
  -H "Authorization: Bearer ${TOKEN}"
```

## Backoffice Endpoints

```bash
curl http://127.0.0.1:8080/api/v1/backoffice/sources \
  -H "Authorization: Bearer ${TOKEN}"

curl -X POST http://127.0.0.1:8080/api/v1/backoffice/sources/bootstrap-feed/ingest \
  -H "Authorization: Bearer ${TOKEN}"

curl http://127.0.0.1:8080/api/v1/backoffice/runs \
  -H "Authorization: Bearer ${TOKEN}"

curl http://127.0.0.1:8080/api/v1/backoffice/events \
  -H "Authorization: Bearer ${TOKEN}"
```

## Generic HTML Listing Sources

For search-result pages from portals, use `kind="html-listings"` and a selector-based `config_json` payload.

Required config keys:

- `item_selector`
- `title_selector`
- `url_selector`
- `price_selector`

Optional config keys:

- `location_selector`
- `external_id_attribute`
- `base_url`
- `currency`

### Idealista Example

```json
{
  "item_selector": "article.item",
  "title_selector": "a.item-link",
  "url_selector": "a.item-link",
  "price_selector": ".item-price",
  "external_id_attribute": "data-element-id",
  "base_url": "https://www.idealista.com",
  "currency": "EUR"
}
```

### Fotocasa Example

```json
{
  "item_selector": "article[class*='@container']",
  "title_selector": "h3 a",
  "url_selector": "h3 a",
  "price_selector": "div.flex.items-center.gap-mdp.text-display-3",
  "location_selector": "p.text-body-1",
  "base_url": "https://www.fotocasa.es",
  "currency": "EUR"
}
```

### Habitaclia Example

```json
{
  "item_selector": "article.js-list-item",
  "title_selector": ".list-item-info a",
  "url_selector": ".list-item-info a",
  "price_selector": ".list-item-price",
  "location_selector": ".list-item-location",
  "external_id_attribute": "data-id",
  "base_url": "https://www.habitaclia.com",
  "currency": "EUR"
}
```

Create one through the backoffice API:

```bash
curl -X POST http://127.0.0.1:8080/api/v1/backoffice/sources \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "idealista-girones",
    "name": "Idealista Girones",
    "kind": "html-listings",
    "endpoint_url": "https://www.idealista.com/ca/venta-viviendas/girona/girones/con-precio-hasta_180000,pisos,estudios,de-un-dormitorio,de-dos-dormitorios,un-bano,dos-banos,para-reformar,buen-estado/?ordenado-por=precios-desc",
    "browser_enabled": true,
    "active": true,
    "config_json": "{\"item_selector\":\"article.item\",\"title_selector\":\"a.item-link\",\"url_selector\":\"a.item-link\",\"price_selector\":\".item-price\",\"external_id_attribute\":\"data-element-id\",\"base_url\":\"https://www.idealista.com\",\"currency\":\"EUR\"}"
  }'
```

## Public Catalog Endpoints

```bash
curl http://127.0.0.1:8080/api/v1/listings
curl http://127.0.0.1:8080/api/v1/listings/<listing-id>
```

## User Feature Endpoints

```bash
curl -X POST http://127.0.0.1:8080/api/v1/me/watchlists \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bilbao picks","query":"sunny"}'

curl -X POST http://127.0.0.1:8080/api/v1/me/bookmarks \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"listing_id":"<listing-id>"}'

curl http://127.0.0.1:8080/api/v1/me/notifications \
  -H "Authorization: Bearer ${TOKEN}"
```

## Notes About The Bootstrap Source Contract

The first connector expects the source payload to be JSON in the following shape:

```json
{
  "items": [
    {
      "external_id": "flat-001",
      "title": "Sunny flat",
      "price_amount": 250000,
      "currency": "EUR",
      "location": "Bilbao",
      "url": "https://example.test/listings/flat-001"
    }
  ]
}
```

This JSON feed remains a useful bootstrap connector for controlled tests and local development.

The backend also supports `html-jsonld` sources that expose listing data inside `<script type="application/ld+json">` payloads.
