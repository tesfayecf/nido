<!--
File Name: README.md
Purpose: Provides folder-level documentation for `cmd/server`.
Responsibilities:
- Explain this folder's role in the backend architecture.
- List contained components and downstream relationships.
- Capture constraints that contributors must preserve.
Inputs / Outputs: Markdown documentation consumed by backend contributors.
Dependencies: Parent and child folder documentation plus linked source files.
Side Effects: None.
Critical Notes: Keep this README synchronized with source changes in this folder.
-->

# Server Command

## Purpose

Starts the HTTP API process.

## Contained components

`main.go` wires config, logger, runtime startup, signal handling, and shutdown.

### Files

- `main.go`

## Interactions with other folders

Consumes `internal/app`, `internal/platform/config`, and exposes HTTP routes.

## Notable patterns and constraints

- Keep package dependencies directed inward through interfaces where application services cross persistence or transport boundaries.
- Keep HTTP request/response shaping in `transport/httpapi` folders and business decisions in `application` folders.
- Keep domain models free of transport concerns unless explicit JSON contracts are part of persisted API behavior.
- Update file headers, symbol comments, and this README in the same change when behavior changes.

## Visual map

```mermaid
flowchart LR
    Parent["Parent folder"] --> This["Server Command"]
    This --> Children["Contained files and subfolders"]
    This --> Consumers["Downstream backend consumers"]
```
