<!--
File Name: data-flow.md
Purpose: Documents backend data flows and workflow diagrams.
Responsibilities:
- Show request, ingestion, engagement, and operational workflows.
- Provide Mermaid diagrams for major backend processes.
- Link workflows back to source folders.
Inputs / Outputs: Markdown workflow guide consumed by engineers and reviewers.
Dependencies: Runtime, transport, application, SQLite, ingestion, engagement, and platformops packages.
Side Effects: None.
Critical Notes: Update diagrams when route flow or persistence flow changes.
-->

# Backend Data Flow

## Request flow

```mermaid
sequenceDiagram
    participant Client
    participant Runtime as internal/app
    participant Middleware as logging/CORS/auth
    participant Handler as transport/httpapi
    participant Service as application
    participant Store as platform/sqlite

    Client->>Runtime: HTTP request
    Runtime->>Middleware: ServeHTTP
    Middleware->>Handler: authorized request
    Handler->>Service: typed inputs
    Service->>Store: query or command
    Store-->>Service: domain result or error
    Service-->>Handler: typed result
    Handler-->>Client: JSON response
```

## Ingestion flow

```mermaid
flowchart TD
    Property[Tracked property] --> Scheduler[Property scheduler]
    Scheduler --> Run[Create property run]
    Run --> Connector[Source connector]
    Connector --> Fetcher[HTTP fetcher]
    Fetcher --> Source[External source]
    Source --> Parser[Parser]
    Parser --> Normalize[Normalize fields/tags/snapshot]
    Normalize --> Store[(SQLite)]
    Store --> Event[Publish event]
    Event --> Engagement[Engagement notification updates]
    Event --> PlatformOps[Platform delivery logs/digests]
```

## Engagement flow

```mermaid
flowchart LR
    Request[Authenticated user request] --> Handler[Engagement HTTP handler]
    Handler --> Service[Engagement service]
    Service --> Store[(SQLite engagement records)]
    Store --> Response[JSON response]
    Event[Ingestion/platform event] --> Notifier[Notifier]
    Notifier --> Store
```

## Backup / restore flow

```mermaid
flowchart TD
    Operator[Authenticated operator] --> PlatformAPI[Platform operations HTTP API]
    PlatformAPI --> Service[Platform operations service]
    Service --> BackupStore[SQLite backup store]
    Service --> FileSystem[Backup directory]
    BackupStore --> SQLite[(SQLite)]
    FileSystem --> Download[Backup file download]
    Upload[Restore upload] --> Service
    Service --> Validate[Normalize and validate backup]
    Validate --> SQLite
```

## Data contract table

| Contract | Producer | Consumer | Persistence |
| --- | --- | --- | --- |
| `authdomain.User` / `Session` | Auth service and SQLite store | Auth transport and middleware | SQLite users/sessions tables |
| `ingestiondomain.Property` | Ingestion service/store | Property handlers, scheduler, engagement | SQLite properties tables |
| `ingestiondomain.PropertySnapshot` | Parser + ingestion service | Analytics and property details | SQLite snapshots/field values |
| `engagementdomain.Notification` | Engagement notifier/service | Notifications API | SQLite notification records |
| `platformopsdomain.WorkspaceBackup` | Platform operations service/store | Backup download/restore API | JSON backup payload plus SQLite import/export |

Events improve observability and notifications, but durable correctness comes from SQLite state.
