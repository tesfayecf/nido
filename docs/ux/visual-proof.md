# UX Visual Proof Notes

## Local verification environment

- Frontend preview: `http://127.0.0.1:4173`
- Backend: `http://127.0.0.1:8080`
- Seed command used: `./cmd/nido.sh seed`
- Demo credentials: `admin@local` / `dev-password`

## Screenshot capture status

An automated screenshot pass was attempted after seeding local data and starting the backend/frontend preview servers. The app was reachable, but browser automation was blocked by the local Playwright lock:

> Browser is already in use for `/root/.cache/ms-playwright/mcp-chrome`, use `--isolated` to run multiple instances of the same browser

Because of that environment constraint, screenshot files could not be captured in this session.

## Workflow diagrams

### Alerts workflow

```mermaid
flowchart LR
    A[Open Alerts page or property alert dialog] --> B[Choose property]
    B --> C[Choose alert rule]
    C --> D{Threshold required?}
    D -- Yes --> E[Enter threshold]
    D -- No --> F[Submit]
    E --> F[Submit]
    F --> G{Request result}
    G -- Success --> H[Toast + dialog closes]
    G -- Failure --> I[Inline error + retry]
```

### Triage row-action workflow

```mermaid
flowchart LR
    A[Open Triage inbox] --> B[Scan prioritized work items]
    B --> C[Choose a row action]
    C --> D[Only selected row enters loading state]
    D --> E{Action result}
    E -- Success --> F[Toast + queries refresh]
    E -- Failure --> G[Toast error + other rows stay actionable]
```

### Source-list navigation workflow

```mermaid
flowchart LR
    A[Open Sources page] --> B[Scan template rows]
    B --> C[Open row or use row icon]
    B --> D[Use overflow menu for secondary actions only]
    D --> E[Run all properties]
    D --> F[Delete source]
```
