# Frontend Feature: Fields

## Purpose

This document explains the frontend ownership of the canonical field-management workflow.

## Context

Fields connect selector outputs to shared analytics-friendly names and metadata.

## Core Concepts

- `FieldsPage` owns field creation, editing, deletion, and unmapped-field assignment.
- The fields feature supports both schema maintenance and cleanup after selector drift.
- The fields feature is closely connected to properties and analytics.

## Behavior / Flow

Frontend responsibilities:

1. list canonical field definitions
2. create or edit field metadata
3. delete obsolete field definitions when safe
4. review unmapped selector groups
5. assign unmapped outputs to canonical fields

## Examples

Examples of important UI areas:

- **Definitions** tab for the shared field library
- **Unmapped** tab for cleanup work after source changes

## Related Docs

- [Components](../components.md)
- [Features / Analytics](./analytics.md)
- [Docs / App / Tutorials / Configuring Fields](../../../docs/app/tutorials/configuring-fields.md)
- [Server Docs / Data Flow](../../../server/docs/data-flow.md)
