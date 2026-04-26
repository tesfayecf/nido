# Frontend Feature: Operations

## Purpose

This document explains the frontend ownership of source templates, runs, dashboard, triage, tags, settings, and admin workflows.

## Context

These pages support operators and administrators who need to monitor workflow health, keep source templates current, and maintain platform configuration.

## Core Concepts

- `features/backoffice` owns source templates and run views.
- `features/operators` owns dashboard and triage.
- `features/tags` owns tag CRUD.
- `features/settings` owns current-user settings.
- `features/platform` owns platform-wide settings and summaries.

## Behavior / Flow

Frontend responsibilities:

1. show reusable source templates and their connected properties
2. expose global run history and run detail inspection
3. summarize operational state on the dashboard and triage pages
4. keep tag management separate from property detail pages
5. expose settings and platform administration in the right navigation groups

## Examples

Examples of owned pages:

- `SourcesPage` and `SourceDetailPage`
- `RunsPage` and `RunDetailPage`
- `DashboardPage` and `TriageInboxPage`
- `AdminPage` and `SettingsPage`

## Related Docs

- [UI Architecture](../ui-architecture.md)
- [Interaction Patterns](../interaction-patterns.md)
- [Docs / App / Features / Source Templates and Runs](../../../docs/app/features/source-templates-and-runs.md)
- [Server Docs / API Contracts](../../../server/docs/api-contracts.md)
