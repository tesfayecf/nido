<!--
File Name: environment-development.md
Purpose: Documents local backend setup and common development failure modes.
Responsibilities:
- List prerequisites and installation steps.
- Explain environment variables and local service dependencies.
- Provide run and validation commands.
Inputs / Outputs: Markdown setup guide consumed by contributors.
Dependencies: go.mod, internal/platform/config, SQLite runtime behavior, root README.
Side Effects: None.
Critical Notes: Keep variable names synchronized with `internal/platform/config/config.go`.
-->

# Development Environment

## Prerequisites

| Tool | Required version / notes |
| --- | --- |
| Go | `1.24.5` as declared in [`../go.mod`](../go.mod) |
| SQLite | Embedded through `modernc.org/sqlite`; no separate server required |
| Shell | POSIX-compatible shell for helper scripts |
| Frontend proxy | Optional; `/app` proxies `/api` to backend during UI development |

## Installation

```bash
cd /home/runner/work/nido/nido/server
go test ./...
```

The first run downloads Go modules into the Go module cache.

## Local run

```bash
cd /home/runner/work/nido/nido/server
go run ./cmd/server
```

Default local admin credentials are configured for development bootstrap:

| Field | Value |
| --- | --- |
| Email | `admin@local` |
| Password | `dev-password` |

## Environment variables

| Variable | Description | Local default / behavior |
| --- | --- | --- |
| `NIDO_ADDR` | HTTP listen address for the backend process | `:8080` |
| `NIDO_DATABASE_PATH` | SQLite database file path | Local runtime default from config loader |
| `NIDO_BACKUP_DIR` | Directory for SQLite and workspace backup files | Local runtime default from config loader |
| `AUTO_MIGRATE` | Enables startup migration policy | Use `true` for local automatic migrations |
| `MIGRATION_STRATEGY` | Migration mode, including safe-auto behavior | `safe-auto` requires backup before schema changes |
| `NIDO_CORS_ALLOWED_ORIGINS` | Comma-separated allowed UI origins | Include `http://127.0.0.1:3000` for Vite |
| `NIDO_BOOTSTRAP_EMAIL` | Bootstrap admin email | `admin@local` |
| `NIDO_BOOTSTRAP_PASSWORD` | Bootstrap admin password | `dev-password` |
| `NIDO_SESSION_TTL` | Bearer session lifetime | Config loader default |
| `NIDO_BROWSER_RENDER_COMMAND` | Optional command for rendered HTML capture | Empty disables command renderer |
| `NIDO_NOTIFICATION_*` | Optional integration notification settings | Disabled unless configured |
| `NIDO_OBJECTSTORE_*` / AWS vars | Optional S3-compatible object storage settings | Memory/local paths unless configured |

## Local services

- SQLite is a file, not a network service.
- External source URLs are only needed when exercising ingestion connectors against real targets.
- Browser rendering is optional and only runs when a render command is configured.

## Validation commands

```bash
cd /home/runner/work/nido/nido/server
go test ./...
go test ./internal/platform/sqlite ./internal/app ./internal/ingestion/application
```

## Common failure modes

| Symptom | Likely cause | Recovery |
| --- | --- | --- |
| Startup fails during migration | `AUTO_MIGRATE`/`MIGRATION_STRATEGY` requires backup or detects integrity failure | Check backup directory permissions and migration status output |
| Login fails for local admin | Bootstrap credentials changed or user already exists with a different password | Use configured bootstrap values or reset local database intentionally |
| CORS rejection from frontend | UI origin missing from CORS config | Add Vite origin to allowed origins |
| Backup creation fails | Backup directory missing or not writable | Create directory and fix permissions |
| Ingestion fetch errors | External source blocks request or returns unexpected shape | Check connector/parser tests and source configuration |
