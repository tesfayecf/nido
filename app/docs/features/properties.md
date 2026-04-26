# Frontend Feature: Properties

## Purpose

This document explains the frontend ownership of the tracked-property workflow.

## Context

The properties feature is the operational center of the frontend. It coordinates with sources, fields, analytics, tags, bookmarks, alerts, and notifications.

## Core Concepts

- `PropertiesPage` owns the list workflow, filters, bulk actions, and bookmarks.
- `PropertyDetailPage` owns property creation, editing, preview, snapshots, property runs, metadata, tags, and alerts.
- `FieldAnalysisPage` supports field-level selector analysis.

## Behavior / Flow

Frontend responsibilities:

1. fetch properties, tags, bookmarks, and recent run summaries
2. render property status, filters, and bulk actions
3. open dedicated detail pages for create and edit flows
4. preview extraction before saving selectors or running ingestion
5. keep tags, alerts, and metadata close to the property detail context

## Examples

Examples of connected services:

- `app/src/services/properties`
- `app/src/services/bookmarks`
- `app/src/services/tags`
- `app/src/services/alert-rules`

## Related Docs

- [UI Architecture](../ui-architecture.md)
- [Features / Analytics](./analytics.md)
- [Features / Engagement](./engagement.md)
- [Docs / App / Features / Property Tracking](../../../docs/app/features/property-tracking.md)
- [Server Docs / API Contracts](../../../server/docs/api-contracts.md)
