<!--
File Name: environment-production.md
Purpose: Documents backend production deployment assumptions and operations.
Responsibilities:
- Describe infrastructure, deployment, configuration, secrets, scaling, and monitoring expectations.
- Capture production risks around migrations, backups, and external integrations.
Inputs / Outputs: Markdown production guide consumed by operators.
Dependencies: Runtime config, SQLite persistence, platformops backup/restore APIs, deployment manifests.
Side Effects: None.
Critical Notes: Production must preserve database and backup volumes before enabling migrations.
-->

# Production Setup

## Infrastructure assumptions

| Component | Requirement |
| --- | --- |
| Runtime | One Go backend process serving HTTP APIs |
| Database | Persistent SQLite file mounted outside ephemeral container storage |
| Backup storage | Persistent directory separate from the SQLite file mount |
| Network | TLS terminates at a reverse proxy or platform load balancer |
| Frontend | Serves UI separately and calls backend `/api/v1/*` routes |
| Secrets | Injected through environment variables or platform secret manager |

## Deployment steps

1. Build the backend container or binary from the repository state being released.
2. Provision persistent volumes for the SQLite database and backup directory.
3. Inject production configuration and secrets.
4. Start with migration settings appropriate to the release.
5. Verify `GET /api/v1/health/live` and `GET /api/v1/health/ready`.
6. Confirm platform backup endpoints can list/create backup files.
7. Monitor logs for migration, scheduler, delivery, and ingestion errors.

## Configuration requirements

| Area | Required production decision |
| --- | --- |
| Database path | Stable path mounted to durable storage |
| Backup directory | Durable path with enough space for pre-migration and workspace backups |
| Migration strategy | Prefer `safe-auto` only when backup directory is healthy; otherwise use controlled/manual migration |
| CORS origins | Explicit production UI origins only |
| Bootstrap user | Set strong bootstrap credentials, then rotate/remove access as policy requires |
| Sessions | Set session TTL aligned with security policy |
| Notifications | Configure only approved webhook/email channels |
| Object store | Configure S3-compatible storage only when features require it |

## Secrets management expectations

- Never commit passwords, tokens, SMTP credentials, webhook URLs, or object-store credentials.
- Inject secrets through the hosting platform secret manager.
- Rotate bootstrap and integration secrets when operators leave or deployments are compromised.
- Ensure logs do not include bearer tokens or secret values.

## Scaling considerations

- SQLite is the system of record; run one writer process unless a deliberate SQLite concurrency architecture is introduced.
- Scheduler concurrency is bounded in `internal/ingestion/application/property_scheduler.go` and should be tuned with source-rate limits in mind.
- Backup and restore operations are I/O-heavy; schedule them outside high-ingestion windows.
- Horizontal scaling requires externalizing scheduler coordination, session storage, and SQLite write coordination first.

## Monitoring and logging entry points

| Signal | Where to inspect |
| --- | --- |
| Process health | `/api/v1/health/live`, `/api/v1/health/ready` |
| Migration status | Platform operations migration/status endpoints and startup logs |
| Scheduler state | Platform operations summary service |
| Delivery failures | Platform operations delivery logs |
| Ingestion failures | Property run records and service logs |
| Auth failures | Auth service logs without token disclosure |

## @critical production risk

Description: Production safety depends on preserving both the SQLite database file and backup directory across deploys.

- Why critical: migrations and restore flows assume durable storage exists before schema or workspace state changes.
- What can break: data recovery, startup migrations, workspace restore, and auditability of migration actions.
- Failure conditions: ephemeral container storage, unwritable backup directory, missing volume mounts, or concurrent writer processes.
