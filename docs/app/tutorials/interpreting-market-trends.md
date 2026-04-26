# Interpreting Market Trends

## Purpose

This tutorial explains how to move from raw analytics output to a practical interpretation of change and opportunity.

## Context

Nido does not provide a separate market-trends engine. Instead, users interpret trends by combining normalized analytics, property snapshots, property-run history, and alerts.

## Core Concepts

- Use analytics to compare values across the current dataset.
- Use snapshots to understand how one property changed over time.
- Use property runs to separate extraction issues from genuine market changes.
- Use alerts and bookmarks to keep follow-up organized.

## Behavior / Flow

1. Open **Market Analysis** and isolate a meaningful slice with filters.
2. Compare average, median, minimum, and maximum values.
3. Select an outlier or interesting segment.
4. Open the related property from the selected records list.
5. Review recent snapshots for historical context.
6. Review property-run status to confirm the extraction is healthy.
7. Save the property or create an alert if the trend needs follow-up.

## Examples

Examples of interpretations:

- A price shift visible in analytics and snapshots is likely a real change.
- A sudden missing value with failed property runs is more likely an extraction issue.
- A cluster with the same location but different price-per-square-meter can highlight opportunities for deeper review.

## Related Docs

- [Tutorials / Understanding Analytics](./understanding-analytics.md)
- [Features / Analytics Workbench](../features/analytics-workbench.md)
- [Features / Alerts and Notifications](../features/alerts-and-notifications.md)
- [App Docs / Features / Properties](../../../app/docs/features/properties.md)
