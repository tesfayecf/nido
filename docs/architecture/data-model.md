# Data Model

## Purpose

This document defines the shared business entities used throughout the repository.

## Context

The same terms appear in backend handlers, frontend services, UX copy, and documentation. This file keeps those terms aligned.

## Core Concepts

- **User**: authenticated operator using the workspace
- **Source template**: reusable extraction template with field selector definitions
- **Tracked property**: monitored URL plus source reference, schedule, retries, status, and business metadata
- **Property config**: versioned selector set for one tracked property
- **Snapshot**: extracted property values stored after ingest
- **Property run**: execution attempt record with status, retries, and timing
- **Field definition**: canonical field metadata for normalized values and analytics
- **Tag**: lightweight categorization attached to tracked properties
- **Bookmark**: saved property association for one user
- **Alert rule**: threshold or condition that can create notifications
- **Notification**: user-visible event requiring awareness or action
- **Platform settings**: outbound delivery and integration configuration
- **Delivery log**: record of test or outbound platform notification activity

## Behavior / Flow

Entity relationships:

1. A source template can support many tracked properties.
2. A tracked property can have many config versions, snapshots, tags, and property runs.
3. Snapshots store extracted values keyed by canonical or raw field names.
4. Field definitions normalize values for analytics and cross-property comparison.
5. Alert rules and bookmarks are scoped to a user and reference tracked properties.
6. Notifications are created from backend workflows and read in the frontend.

Important distinctions:

- A **snapshot** is not the same as a **property run**.
- A **field definition** is not the same as a raw selector output.
- A **source template** is not the same as a tracked property.

## Examples

Examples in the codebase:

- Property HTTP contract: `server/internal/ingestion/transport/httpapi/property_handlers.go`
- Field HTTP contract: `server/internal/ingestion/transport/httpapi/field_handlers.go`
- Frontend property services: `app/src/services/properties`
- Frontend analytics services: `app/src/services/analytics`

## Related Docs

- [System Design](./system-design.md)
- [References / Glossary](../references/glossary.md)
- [Server Docs / API Contracts](../../server/docs/api-contracts.md)
- [App Docs / Features / Properties](../../app/docs/features/properties.md)
- [Docs App / Features / Property Tracking](../app/features/property-tracking.md)
