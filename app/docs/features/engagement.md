# Frontend Feature: Engagement

## Purpose

This document explains the frontend ownership of bookmarks, alerts, and notifications.

## Context

Engagement workflows are user-specific and support follow-up rather than repository-wide administration.

## Core Concepts

- bookmarks provide quick return paths to tracked properties
- alerts define conditions for future follow-up
- notifications show user-visible outcomes and can be marked read or unread

## Behavior / Flow

Frontend responsibilities:

1. list user bookmarks
2. create and remove alert rules
3. list notifications with unread filtering support from the backend
4. mark notifications read or unread
5. connect engagement actions back to property workflows

## Examples

Examples of connected frontend services:

- `app/src/services/bookmarks`
- `app/src/services/alert-rules`
- `app/src/services/notifications`

## Related Docs

- [Features / Properties](./properties.md)
- [Docs / App / Features / Alerts and Notifications](../../../docs/app/features/alerts-and-notifications.md)
- [Server Docs / API Contracts](../../../server/docs/api-contracts.md)
- [Docs / Architecture / Data Model](../../../docs/architecture/data-model.md)
