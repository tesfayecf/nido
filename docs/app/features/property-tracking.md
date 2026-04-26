# Property Tracking

## Purpose

This guide explains the main tracked-property workflow from creation through monitoring.

## Context

Tracked properties are the operational center of the product. Most other features exist to support or interpret tracked-property data.

## Core Concepts

- A property stores URL, source reference, schedule, retry settings, tags, and business metadata.
- A property detail view exposes selectors, preview, snapshots, runs, tags, alerts, and metadata.
- Bookmarks and alerts are follow-up tools, not ownership of the property record itself.

## Behavior / Flow

Main user actions:

- create or edit a property
- preview selectors
- save a selector configuration
- trigger a run
- inspect snapshots and property-run history
- pause or resume scheduling
- assign tags and business metadata

## Examples

Inputs and outputs:

- **Inputs**: URL, source template, selector rows, schedule interval, retry policy, metadata
- **Outputs**: updated property record, preview result, snapshots, property runs, tags, alerts

## Related Docs

- [Tutorials / Creating a Property](../tutorials/creating-a-property.md)
- [Features / Source Templates and Runs](./source-templates-and-runs.md)
- [App Docs / Features / Properties](../../../app/docs/features/properties.md)
- [Server Docs / API Contracts](../../../server/docs/api-contracts.md)
