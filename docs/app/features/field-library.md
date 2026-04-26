# Field Library

## Purpose

This guide explains why the field library exists and how it affects the rest of the product.

## Context

Field definitions provide a shared schema across source templates, tracked properties, and analytics.

## Core Concepts

- Fields standardize naming and data typing.
- Unmapped-field review prevents selector drift from silently degrading analytics.
- Defaults, units, and comparison rules help downstream interpretation.

## Behavior / Flow

Users typically:

1. review definitions
2. create or edit canonical fields
3. assign unmapped selector outputs
4. re-run preview or ingestion
5. confirm the normalized values appear correctly in analytics

## Examples

Critical edge case:

- If two source templates use different raw selector names for the same concept, mapping both to one canonical field keeps analytics comparable.

## Related Docs

- [Tutorials / Configuring Fields](../tutorials/configuring-fields.md)
- [Features / Analytics Workbench](./analytics-workbench.md)
- [App Docs / Features / Fields](../../../app/docs/features/fields.md)
- [Architecture / Data Model](../../architecture/data-model.md)
