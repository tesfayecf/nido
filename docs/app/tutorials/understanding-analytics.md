# Understanding Analytics

## Purpose

This tutorial explains how to use the Analytics page to inspect normalized property data.

## Context

Analytics uses canonical field definitions and the latest normalized values from tracked properties. It is designed for quick filtering and comparison, not for long-form reporting.

## Core Concepts

- **Summary** shows key metrics for the current filtered scope.
- **Visualization** switches between histogram, bar, line, and scatter views.
- **Controls** choose measure, parameter, metric, segment, and filters.
- **Selected records** helps users inspect the records behind a chart selection.

## Behavior / Flow

1. Open **Market Analysis** from the navigation.
2. Confirm there is ingested property data in the dataset.
3. Choose a **Measure** such as price.
4. Choose a chart type.
5. Add one or more filters to narrow the scope.
6. Optionally choose a grouping parameter or segment.
7. Hover over or select a chart element to inspect the backing records.
8. Use the summary cards to compare the filtered scope to your expectations.

## Examples

Useful first views:

- Histogram of `price`
- Average `price` by `location`
- Scatter chart of `surface_area` against `price`

## Related Docs

- [Tutorials / Interpreting Market Trends](./interpreting-market-trends.md)
- [Features / Analytics Workbench](../features/analytics-workbench.md)
- [App Docs / Features / Analytics](../../../app/docs/features/analytics.md)
- [App Docs / State Management](../../../app/docs/state-management.md)
