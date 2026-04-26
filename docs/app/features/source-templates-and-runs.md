# Source Templates and Runs

## Purpose

This guide explains how source templates and runs support tracked-property monitoring.

## Context

Source templates define reusable extraction logic. Runs show what happened when the system attempted to collect or process property data.

## Core Concepts

- Source templates can be reused across multiple properties.
- Global runs show stored run records and let operators inspect recent activity.
- Property detail pages show property-specific snapshots and property-run history.
- Runs help diagnose extraction failures, schedule problems, and data freshness.

## Behavior / Flow

Main workflow:

1. create or edit a source template
2. connect it to one or more tracked properties
3. trigger a run for one property or all properties using a source template
4. inspect global runs or a property’s own history
5. update selectors when a source changes

## Examples

Important distinction:

- A global run table is useful for operational review.
- A property detail view is better when you need selector context, snapshots, and config history for one property.

## Related Docs

- [Features / Property Tracking](./property-tracking.md)
- [App Docs / Features / Operations](../../../app/docs/features/operations.md)
- [Server Docs / Data Flow](../../../server/docs/data-flow.md)
- [Server Docs / API Contracts](../../../server/docs/api-contracts.md)
