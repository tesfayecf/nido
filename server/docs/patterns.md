# Backend Patterns

## Keep

- explicit runtime wiring in `internal/app/runtime.go`
- thin HTTP handlers
- one owning application service per rule
- SQL isolated in `internal/platform/sqlite`

## Avoid

- hidden control flow across multiple helper layers
- SQL in handlers
- duplicate business rules across services
- configuration that is parsed but not used by the active runtime
