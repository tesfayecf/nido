<!--
File Name: patterns.md
Purpose: Documents backend implementation patterns and constraints.
Responsibilities:
- State code organization rules.
- Preserve maintainability and traceability expectations.
- Identify fragile patterns that require explicit documentation updates.
Inputs / Outputs: Markdown pattern guide consumed by backend contributors.
Dependencies: Source layout, folder READMEs, file headers, and symbol comments.
Side Effects: None.
Critical Notes: Use this as a review checklist for backend changes.
-->

# Backend Patterns

## Keep

- Explicit runtime wiring in `internal/app/runtime.go`.
- Thin HTTP handlers that decode, authorize, call services, and encode responses.
- Business rules in `application` packages.
- Stable contracts in `domain` packages.
- SQL, migrations, backup, and restore implementation in `internal/platform/sqlite`.
- Store interfaces owned by application packages and implemented by SQLite stores.
- Folder README, file header, and function/type docs updated with behavior changes.

## Avoid

- Hidden control flow across multiple helper layers.
- SQL inside HTTP handlers.
- Duplicate business rules across services.
- Configuration parsed but not used by the active runtime.
- Background scheduler behavior that is not represented in platform operations summaries.
- Adding routes without API contract documentation.

## Critical annotation standard

Use this block shape near fragile code or in linked docs:

```go
/**
 * @critical
 * Description: Explain the risk in concrete terms.
 * Why critical: Explain why the behavior is high impact.
 * What can break: List affected workflows or data.
 * Failure conditions: List exact conditions that trigger the risk.
 */
```

## Review checklist

| Check | Expected evidence |
| --- | --- |
| Folder-level comprehension | Nearest `README.md` explains purpose, components, interactions, constraints |
| File-level comprehension | Source file begins with standardized header |
| Symbol-level comprehension | Changed functions/types have structured docs |
| Cross-reference coverage | Docs link upstream dependencies and downstream consumers |
| Visual coverage | Major flow changes update Mermaid diagrams |
| Validation | `go test ./...` passes after the change |
