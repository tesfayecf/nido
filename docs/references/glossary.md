# Glossary

## Purpose

This glossary defines the repository terms that should be used consistently across all documentation.

## Context

Several old documents used overlapping terms for runs, snapshots, listings, and market workflows. This glossary prevents that drift.

## Core Concepts

- **Analytics dataset**: normalized records returned by `/api/v1/backoffice/analytics/dataset`
- **Bookmark**: user-scoped saved property record
- **Delivery log**: outbound platform notification log entry
- **Field definition**: canonical field schema entry
- **Property config**: versioned selector configuration for one property
- **Property run**: execution attempt record for a tracked property
- **Snapshot**: extracted property values stored after an ingest
- **Source template**: reusable extraction template for one upstream source
- **Tracked property**: monitored URL with workflow metadata

## Behavior / Flow

Documentation rules:

- use **tracked property**, not just **listing**, for the active product workflow
- use **source template**, not just **source**, when the reusable extraction definition is the focus
- use **property run** for attempt history and **snapshot** for extracted values
- use **frontend** for `/app` and **backend** for `/server`

## Examples

Correct usage examples:

- “Open the tracked property detail page and inspect the latest snapshot.”
- “Use the property-run history to distinguish scheduler failures from data changes.”

## Related Docs

- [References / Conventions](./conventions.md)
- [Architecture / Data Model](../architecture/data-model.md)
- [Server Docs / Overview](../../server/docs/overview.md)
- [App Docs / Overview](../../app/docs/overview.md)
