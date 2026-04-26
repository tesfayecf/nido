# Configuring Fields

## Purpose

This tutorial explains how to keep extracted values aligned with the shared field library.

## Context

Fields make analytics and cross-property comparison possible. They also keep selector outputs consistent across different source templates.

## Core Concepts

- **Fields** contains the shared canonical field library.
- **Definitions** define display names, data types, defaults, units, and matching rules.
- **Unmapped** groups reveal selector outputs that are not yet linked to a canonical field.
- Property detail pages use the same field vocabulary when editing selectors.

## Behavior / Flow

1. Open **Fields** from the main navigation.
2. Review the **Definitions** tab to confirm the field already exists.
3. If needed, select **Create field** and provide the name, display name, data type, and optional metadata.
4. Open the **Unmapped** tab.
5. Find the selector output that should map to the canonical field.
6. Use the assignment action to link the unmapped selector to the chosen field.
7. Return to the affected property and preview extraction again.
8. Confirm that analytics now uses the normalized field.

## Examples

Common field examples:

- `price`
- `location`
- `rooms`
- `surface_area`

## Related Docs

- [Features / Field Library](../features/field-library.md)
- [Tutorials / Understanding Analytics](./understanding-analytics.md)
- [App Docs / Features / Fields](../../../app/docs/features/fields.md)
- [Architecture / Data Model](../../architecture/data-model.md)
