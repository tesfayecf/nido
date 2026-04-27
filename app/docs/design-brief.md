# Frontend Design Brief

## Purpose

This document gives designers a working UI and UX brief for the product before visual exploration starts.

## Context

Nido is an authenticated property-tracking workspace for operators. The product helps users maintain tracked properties, manage reusable source templates, review ingestion runs, interpret normalized field data, and follow up through bookmarks, alerts, and notifications.

This is not a public consumer listing site. It is an operational console used to review many records, understand change over time, diagnose extraction issues, and decide what action to take next.

## Core Concepts

- Properties are the center of the product.
- Analytics supports investigation and comparison, not final record editing.
- Sources, runs, and fields exist to keep property data trustworthy and usable.
- Bookmarks, alerts, and notifications support follow-up and triage.
- The shell should feel stable over long sessions with predictable navigation and clear status visibility.

## Design Intent

- Make the product feel like a calm, credible operations workspace for acquisition and monitoring work.
- Optimize for scan, inspect, decide, and act loops across dense datasets.
- Keep the UI data-first and trustworthy. Users need confidence in freshness, status, and provenance.
- Let users move easily between global overview, filtered lists, and a single property's working context.
- Support light, dark, and system themes without losing clarity or hierarchy.

## UX Principles

1. Lead with decisions. Each page should surface the status, summary, filters, or actions that help users decide what to do next.
2. Keep properties central. Secondary workflows should clearly connect back to a property, run, field, or alert.
3. Favor dense clarity over minimal emptiness. Use cards, tables, panels, and badges to make high information density readable without feeling cluttered.
4. Inspect before commit. Preview, validate, and compare data before users save selectors, trigger runs, or take destructive actions.
5. Keep actions close to the data they affect. Edits, tags, alerts, and runs should stay near the relevant record context.
6. Make system state obvious. Run health, freshness, alert state, unread state, and failures should never be ambiguous.
7. Preserve comparability. Charts, summary metrics, and list views should make outliers, changes, and trends easy to spot at a glance.
8. Design safe operations. Destructive actions require explicit confirmation and all mutations should return immediate feedback.
9. Keep accessibility stable. Controls need clear labels, keyboard support, and consistent accessible names across the app.
10. Design desktop-first, then compress carefully. The primary workflows are information-dense and benefit from larger screens, but smaller screens should still support review and triage tasks.

## Visual Direction

- Tone: analytical, reliable, quiet, operational.
- Avoid: consumer real-estate tropes, lifestyle imagery, overly playful interactions, or decorative dashboards that hide the work.
- Prefer: restrained blue and slate foundations, crisp surfaces, strong typography, semantic status colors, and clear spacing rhythm.
- Let layout, contrast, and status treatment create emphasis before adding decorative elements.

Current foundation already in the app:

- IBM Plex Sans-based typography
- blue and slate design tokens with semantic success, warning, and danger colors
- light, dark, and system theme support
- established shell, table, dialog, badge, and detail-page patterns

## Priority Surfaces

- App shell and navigation: clear grouping, strong sense of place, compact but readable chrome
- Properties list: fast scanning, visible filters, obvious shortlist and bookmark actions
- Property detail: a working surface for metadata, selectors, preview, snapshots, runs, tags, and alerts
- Analytics workbench: guided exploration with a clear path back to underlying records
- Operations surfaces: dashboard, triage, notifications, runs, and sources for monitoring workflow health
- Admin surfaces: fields, tags, settings, and admin console with high clarity and low ornament

## Interaction Guidance

- Tables should support quick scanning, visible filtering, and compact row-level actions.
- Charts should always connect back to the records behind the result.
- Empty, loading, and error states should explain the operational meaning of the state.
- Hover can add efficiency, but primary actions cannot depend on hover alone.
- Navigation should group workflows by operator intent rather than exposing a flat list of backend entities.
- Theme switching should feel polished and accessible, but secondary to the product's working tasks.

## Designer Prompt

Design Nido as a desktop-first authenticated property-tracking and acquisition workspace for operators, not a public consumer listing site. The UI should help users scan many properties, inspect individual records, validate extracted data, compare market patterns in analytics, diagnose source and run issues, and follow up with bookmarks, alerts, and notifications. Prioritize calm information density, visible system status, predictable navigation, and trustworthy operational polish. Build around a left-nav application shell, strong table and detail-page patterns, explicit feedback for mutations, and analytics views that connect back to real records. Use a restrained blue and slate visual system with semantic status colors, support light, dark, and system themes, and make the product feel precise, efficient, and credible rather than flashy.

## Related Docs

- [Overview](./overview.md)
- [Page Inventory & Wireframes](./page-inventory.md)
- [Design System Brief](./design-system-brief.md)
- [UI Architecture](./ui-architecture.md)
- [Interaction Patterns](./interaction-patterns.md)
- [Docs / App / Overview](../../docs/app/overview.md)
- [Docs / Architecture / System Overview](../../docs/getting-started/system-overview.md)