# Backend Modules

| Concern | Owner |
| --- | --- |
| Runtime composition | `internal/app` |
| Auth | `internal/auth` |
| Engagement | `internal/engagement` |
| Sources, properties, fields, tags, analytics dataset | `internal/ingestion` |
| Platform settings, backup, restore, deliveries | `internal/platformops` |
| Shared config, HTTP helpers, events, IDs, SQLite | `internal/platform` |

## Where to change code

- endpoint shape: `transport/httpapi`
- business rule: `application`
- query or schema detail: `internal/platform/sqlite`
- startup behavior: `internal/app/runtime.go`
