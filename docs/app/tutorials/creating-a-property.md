# Creating a Property

## Purpose

This tutorial explains how to create a tracked property and confirm that it is ready for monitoring.

## Context

A tracked property links one property URL to a source template, selector configuration, scheduling settings, and business metadata.

## Core Concepts

- The **Properties** page is the main list and entry point.
- The **New property** screen collects the URL, source, schedule, retries, and metadata.
- The **Preview extraction** action checks selectors before a full ingest.
- The **Run now** action creates a fresh snapshot.

## Behavior / Flow

1. Open **Properties** from the main navigation.
2. Select **New property**.
3. Enter the property URL.
4. Choose the source template that matches the upstream site.
5. Set the schedule interval if the property should refresh automatically.
6. Set retry attempts and retry backoff if the source is unstable.
7. Save the property.
8. On the property detail page, review the selector rows and run **Preview extraction**.
9. If the preview looks correct, trigger a run and review the latest snapshot and property-run status.

## Examples

UI elements used in this workflow:

- **Properties** navigation item
- **New property** button
- **Source** dropdown
- **Preview extraction** button
- **Run now** action on the property detail page

## Related Docs

- [Features / Property Tracking](../features/property-tracking.md)
- [Tutorials / Configuring Fields](./configuring-fields.md)
- [App Docs / Features / Properties](../../../app/docs/features/properties.md)
- [App Docs / Interaction Patterns](../../../app/docs/interaction-patterns.md)
