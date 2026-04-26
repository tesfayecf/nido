# Frontend Feature: Analytics

## Purpose

This document explains the frontend ownership of the analytics workflow.

## Context

The analytics feature turns normalized backend data into filters, summaries, and charts that operators can explore quickly.

## Core Concepts

- `AnalyticsPage` owns chart selection, filter drafting, and selected-record inspection.
- `analytics.utils.ts` owns chart-specific transformations and summary logic.
- Analytics depends on the fields service and the analytics dataset service.

## Behavior / Flow

Frontend responsibilities:

1. fetch field definitions and analytics dataset records
2. build valid field options for measures, groupings, and segments
3. apply filter logic in the browser
4. render summary metrics and charts
5. expose the selected records behind chart interactions

## Examples

Examples of analytics-specific concerns:

- histogram and scatter chart preparation
- numeric parsing for field values
- filter drafting and validation

## Related Docs

- [State Management](../state-management.md)
- [Features / Properties](./properties.md)
- [Docs / App / Tutorials / Understanding Analytics](../../../docs/app/tutorials/understanding-analytics.md)
- [Server Docs / API Contracts](../../../server/docs/api-contracts.md)
