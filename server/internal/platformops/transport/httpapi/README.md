<!--
File Name: README.md
Purpose: Provides folder-level documentation for `internal/platformops/transport/httpapi`.
Responsibilities:
- Explain this folder's role in the backend architecture.
- List contained components and downstream relationships.
- Capture constraints that contributors must preserve.
Inputs / Outputs: Markdown documentation consumed by backend contributors.
Dependencies: Parent and child folder documentation plus linked source files.
Side Effects: None.
Critical Notes: Keep this README synchronized with source changes in this folder.
-->

# Platform Operations HTTP API

## Purpose

Adapts platform operations service to authenticated HTTP endpoints.

## Contained components

Settings, backups, restore, reset, migration status, and delivery test handlers.

### Files

- `handlers.go`

## Interactions with other folders

Depends on auth middleware context and platformops application service.

## Notable patterns and constraints

- Keep package dependencies directed inward through interfaces where application services cross persistence or transport boundaries.
- Keep HTTP request/response shaping in `transport/httpapi` folders and business decisions in `application` folders.
- Keep domain models free of transport concerns unless explicit JSON contracts are part of persisted API behavior.
- Update file headers, symbol comments, and this README in the same change when behavior changes.

## Visual map

```mermaid
flowchart LR
    Parent["Parent folder"] --> This["Platform Operations HTTP API"]
    This --> Children["Contained files and subfolders"]
    This --> Consumers["Downstream backend consumers"]
```
