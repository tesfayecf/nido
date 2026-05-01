# Backend Data Flow

## Request flow

```text
HTTP request
  -> logging + CORS
  -> auth middleware for protected routes
  -> transport/httpapi handler
  -> application service
  -> sqlite store
  -> JSON response
```

## Ingestion flow

```text
property selected
  -> fetch page content
  -> extract configured fields
  -> persist snapshot + property run
  -> emit optional live events
```

## Engagement flow

```text
bookmark or alert change
  -> engagement service
  -> sqlite store
  -> notification records
```

Events help observability, but correctness still comes from stored state.
