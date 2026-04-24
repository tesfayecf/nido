# Frontend Backend Contract

## Scope

This document covers the backend surface the frontend currently uses. It reflects mounted routes in the current server runtime, not every package that exists in the repository.

Important runtime note:

- Auth, engagement, sources, properties, tags, global runs, property runs, and live events are mounted today.
- The backend still contains a `catalog` package with `/api/v1/listings` handlers, but `internal/app/runtime.go` does not currently register those routes. Do not build new UI on the listings surface until the runtime is updated.

## Common Wire Conventions

### Authentication

- Protected endpoints require `Authorization: Bearer <token>`.
- The frontend passes bearer tokens through `lib/api/client.ts` and `lib/api/sse.ts` only.
- A `401` should be treated as session loss. The frontend clears protected client state and lets `RequireAuth` redirect back to `/login`.

### Response envelopes

The current API uses three common shapes:

- list responses: `{ items: T[], count: number }`
- single-item responses: `{ item: T }`
- status responses: `{ status: string }`

The main exception is login:

```json
{
  "token": "<bearer>",
  "user": {
    "id": "user_123",
    "email": "admin@local",
    "display_name": "Local Admin"
  },
  "expires_at": "2026-04-25T10:00:00Z"
}
```

### Error payloads

Transport handlers normally respond with:

```json
{
  "error": "human-readable message"
}
```

The frontend should not rely on richer machine-readable error codes unless a capability explicitly adds them.

## Active Route Groups

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Returns `{ token, user, expires_at }` |
| `GET` | `/api/v1/auth/me` | Returns `{ user }` for current bearer token |
| `POST` | `/api/v1/auth/logout` | Revokes the current session |
| `PUT` | `/api/v1/auth/me` | Updates profile display name |
| `POST` | `/api/v1/auth/me/password` | Changes the current password |

### Personal Tracking

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/me/bookmarks` | Returns bookmarked properties |
| `POST` | `/api/v1/me/bookmarks` | Body: `{ property_id }` |
| `DELETE` | `/api/v1/me/bookmarks/{propertyID}` | Removes bookmark |
| `GET` | `/api/v1/me/alert-rules` | Returns alert rules |
| `POST` | `/api/v1/me/alert-rules` | Body: `{ property_id, rule_type, threshold_amount? }` |
| `DELETE` | `/api/v1/me/alert-rules/{ruleID}` | Deletes alert rule |
| `GET` | `/api/v1/me/notifications` | Supports `unread_only` and `limit` query params |
| `POST` | `/api/v1/me/notifications/{notificationID}/read` | Marks notification read |
| `POST` | `/api/v1/me/notifications/{notificationID}/unread` | Marks notification unread |

There is no mounted watchlist surface in the current runtime.

### Backoffice Sources

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/backoffice/sources` | List all sources |
| `POST` | `/api/v1/backoffice/sources` | Upsert source record |
| `GET` | `/api/v1/backoffice/sources/{sourceID}` | Load one source |
| `DELETE` | `/api/v1/backoffice/sources/{sourceID}` | Delete source |

Source records exist mainly to supply reusable source metadata and selector defaults for tracked properties. A source-level ingest route is not mounted in the current runtime.

### Backoffice Properties

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/backoffice/properties` | Supports repeated `tag_id`, `tag_match`, and `status` filters |
| `POST` | `/api/v1/backoffice/properties` | Create tracked property |
| `POST` | `/api/v1/backoffice/properties/preview` | Stateless extraction preview |
| `GET` | `/api/v1/backoffice/properties/{propertyID}` | Load one property |
| `PUT` | `/api/v1/backoffice/properties/{propertyID}` | Update tracked property |
| `DELETE` | `/api/v1/backoffice/properties/{propertyID}` | Delete property and dependent records |
| `POST` | `/api/v1/backoffice/properties/{propertyID}/config` | Save extraction config version |
| `GET` | `/api/v1/backoffice/properties/{propertyID}/config` | Load latest config |
| `POST` | `/api/v1/backoffice/properties/{propertyID}/preview` | Preview using an existing property context |
| `POST` | `/api/v1/backoffice/properties/{propertyID}/ingest` | Trigger one manual ingest |
| `GET` | `/api/v1/backoffice/properties/{propertyID}/snapshots` | Snapshot history, supports `limit` |
| `GET` | `/api/v1/backoffice/properties/{propertyID}/runs` | Scheduler attempt history, supports `limit` |

### Backoffice Tags

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/backoffice/tags` | List tags |
| `POST` | `/api/v1/backoffice/tags` | Create tag |
| `DELETE` | `/api/v1/backoffice/tags/{tagID}` | Delete tag |
| `GET` | `/api/v1/backoffice/properties/{propertyID}/tags` | List property tag assignments |
| `PUT` | `/api/v1/backoffice/properties/{propertyID}/tags` | Replace all tag assignments |
| `POST` | `/api/v1/backoffice/properties/{propertyID}/tags/{tagID}` | Assign one tag |
| `DELETE` | `/api/v1/backoffice/properties/{propertyID}/tags/{tagID}` | Remove one tag |

### Backoffice Runs And Events

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/backoffice/runs` | Returns stored property snapshots, optionally filtered by `property_id` |
| `GET` | `/api/v1/backoffice/runs/{runID}` | Returns one stored property snapshot |
| `DELETE` | `/api/v1/backoffice/runs/{runID}` | Deletes one stored property snapshot |
| `GET` | `/api/v1/backoffice/events` | Authenticated SSE stream |

Important distinction:

- `/api/v1/backoffice/runs*` is a snapshot history surface.
- `/api/v1/backoffice/properties/{propertyID}/runs` returns scheduler attempt records with `pending | running | success | failed` status and retry metadata.

## Property DTO Notes

### Property shape

```json
{
  "id": "prop_123",
  "url": "https://example.test/property/123",
  "label": "Main tracker",
  "source_id": "idealista-girones",
  "status": "active",
  "schedule_interval_seconds": 3600,
  "retry_max_attempts": 3,
  "retry_backoff_millis": 1500,
  "last_run_at": "2026-04-24T09:00:00Z",
  "next_run_at": "2026-04-24T10:00:00Z"
}
```

### Extraction config shape

```json
{
  "fields": [
    {
      "name": "price",
      "selector_type": "css",
      "selector_value": ".price",
      "fallback_selectors": [".price-value"],
      "extraction_mode": "text",
      "text_mode": "textContent",
      "attribute": "",
      "transform": "number",
      "required": true
    }
  ]
}
```

### Preview result shape

```json
{
  "item": {
    "values": {
      "price": "350000",
      "title": "3-bed apartment"
    },
    "fields": [
      {
        "name": "price",
        "selector_type": "css",
        "selector_value": ".price",
        "extraction_mode": "text",
        "match_count": 1,
        "used_fallback": false,
        "value": "350000",
        "success": true,
        "error_code": "ok"
      }
    ],
    "failures": [],
    "success": true
  }
}
```

### Status values

Property status values:

- `pending`: the property has never completed a successful run
- `active`: the latest ingest produced all required fields
- `degraded`: the latest ingest failed or required fields were missing
- `inactive`: the property is intentionally disabled

Property-run status values:

- `pending`
- `running`
- `success`
- `failed`

## SSE Contract

The server publishes standard SSE frames with `id`, `event`, and `data` fields:

```text
id: evt_123
event: run.completed
data: {"property_id":"prop_123","run_id":"prun_456","snapshot_id":"run_789","is_valid":true}
```

Current server event names include at least:

- `notification.created`
- `property.created`
- `property.updated`
- `property.run.completed`
- `property.run.failed`
- `run.scheduled`
- `run.started`
- `run.completed`
- `run.failed`
- `tag.created`
- `tag.deleted`
- `tag.assigned`
- `tag.unassigned`
- `ingestion.fetch.started`
- `ingestion.fetch.completed`
- `ingestion.parse.completed`
- `ingestion.reconcile.completed`
- `ingestion.run.started`
- `ingestion.run.completed`
- `ingestion.run.failed`

The frontend intentionally treats `type` as an open set. If you add new server events, the UI should continue to decode them without a frontend deploy unless a feature needs special handling.

## Maintenance Rules For Contract Changes

- Add or change routes in the backend transport layer first, then update the matching service module in `app/src/services`.
- Keep envelope styles stable unless there is a strong reason to break them.
- If backend preview or property DTOs gain new fields, update `app/src/services/properties/properties.types.ts` at the same time.
- Treat snapshot routes and property-run routes as separate concepts in both naming and UI copy.
- When documenting future catalog/listings work, be explicit about whether the runtime actually mounts it.
