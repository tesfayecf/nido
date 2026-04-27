# Page Inventory & Wireframes

## Purpose

This document turns the product brief into a Figma-ready page inventory with suggested wireframe structure.

## Context

The frontend is a route-driven authenticated workspace with a stable shell, dense page cards, table-heavy workflows, and decision-support analytics. Designers should preserve that operational posture while improving hierarchy, pacing, and visual clarity.

## Working Frame Set

Start with these frames before exploring polished comps:

- `1440 x 1024` desktop shell, expanded navigation
- `1280 x 960` desktop shell, collapsed navigation
- `1600 x 1024` dense analytics view for charts and side controls
- `1024 x 768` tablet review state for list and detail pages
- `390 x 844` mobile triage and quick-review state

Important current shell constants from the app:

- expanded nav width: `15rem` (`240px`)
- collapsed nav width: `3.5rem` (`56px`)
- header height: `3.25rem` (`52px`)
- content containers: `48rem`, `64rem`, `80rem`

## Global Shell Template

Current shell anatomy:

- left navigation grouped by operator intent: Core workflow, Operations, Admin / Advanced, Account
- top header with sidebar toggle, breadcrumb, page title, and command slot
- main content area built as a vertical `PageStack` of dense cards
- skip link support for keyboard users

Suggested base wireframe:

```text
+-----------------------------------------------------------------------------------+
| Sidebar nav (240 / 56) | Header: breadcrumb + page title + utility actions       |
+------------------------+----------------------------------------------------------+
|                        | Page intro card or page header                           |
|                        +----------------------------------------------------------+
|                        | Primary working content                                  |
|                        | built from one or more dense cards / panels              |
|                        +----------------------------------------------------------+
|                        | Secondary supporting content, if needed                  |
+-----------------------------------------------------------------------------------+
```

Designer notes:

- Use the shell to create orientation, not decoration.
- Keep navigation visually compact but scannable over long sessions.
- Treat the header as a utility strip, not a marketing hero.
- The theme system already exists, but the toggle is currently surfaced in login and settings rather than the global header.

## Core Page Inventory

### Properties List

Intent:

- Help users scan the portfolio quickly.
- Compare price, size, status, and opportunity signals in one table.
- Let users jump directly into a property, bookmark it, or trigger a run.

Current implementation anchors:

- page-level card with title, column menu, and primary CTA
- resizable, reorderable, hideable columns
- dedicated filter row in the table header
- row-level actions for open, bookmark, and run

Suggested wireframe hierarchy:

```text
Properties page
1. Title + short page description
2. Right-aligned actions: Columns, New property
3. Table shell
4. Sticky or visually attached filter row
5. Dense data grid
6. Row actions rail
```

Suggested layout zones:

- Zone A: page header and utility actions
- Zone B: grid controls and persistent view settings
- Zone C: main comparison table
- Zone D: row action affordances that stay compact and obvious

Design emphasis:

- Make filterability feel immediate and lightweight.
- Preserve the data-first posture; avoid oversized summary cards above the table.
- Use status and opportunity treatments that are readable without overwhelming the grid.
- Keep resizing, reordering, and column visibility settings visually understandable.

### Property Detail

Intent:

- Turn one property into a decision and action workspace.
- Bring live state, notes, selectors, extracted values, runs, snapshots, config history, tags, and alerts into one place.
- Separate monitoring from editing without making edit flows hard to reach.

Current implementation anchors:

- top summary card with back, edit, delete, and core property metadata
- notes and decision card
- price intelligence card with signal tabs
- attributes card
- field configuration card with selector builder, preview, and save actions
- current extracted values card with row links to field analysis
- tags, automation runs, recent snapshots, config history, and alerts cards
- shared editor content used as full page in create mode and dialog in edit mode

Suggested desktop wireframe grouping:

```text
Property detail
1. Summary band with title, status, schedule, freshness, and actions
2. Two-column insight row
   left: Notes & Decision
   right: Price Intelligence
3. Two-column working row
   left: Current Extracted Values + Attributes + Automation Runs
   right: Field Configuration + Tags + Alerts
4. Secondary history row
   left: Recent Snapshots
   right: Config History
```

Suggested create and edit variants:

- New property: full-page editor with focused progression from metadata to source configuration
- Edit property: modal editor or structured side panel using the same form language, while the detail page remains the source of truth

Design emphasis:

- The top of the page should answer: What is this property, what is its current state, and what should I do next?
- Keep decision-support surfaces close to operational facts.
- Make selector work feel technical but not intimidating.
- Use tabs carefully for dense supporting data such as signal groups or config diffs.

### Analytics Workbench

Intent:

- Help operators explore normalized data quickly.
- Let users move from summary to chart to record-level inspection without leaving the page.

Current implementation anchors:

- top analytics card with async loading and empty-state handling
- summary metrics card
- visualization and controls split in a `2.2fr / 1fr` layout
- selected-record inspection panel
- active-analysis reference card

Suggested desktop wireframe:

```text
Analytics
1. Page intro and purpose
2. Summary strip
3. Main split layout
   left: Visualization card
   right: Controls card
4. Inspection row
   left: Detail inspection / filtered properties
   right: Active analysis summary
```

Design emphasis:

- Make the chart area feel central without turning the page into a generic BI dashboard.
- Controls should feel methodical and composable, not like a form dump.
- When a chart point is active, show the connection to underlying records clearly.
- Preserve the sense that analytics is for investigation and comparison, not final record editing.

### Portfolio Dashboard

Intent:

- Provide a quick operational read on the portfolio before the user goes deeper.

Current implementation anchors:

- summary metric row
- paired chart cards for price distribution, movement, and dynamics
- ranked opportunities and change-tracking lists
- plain-language portfolio state card

Suggested wireframe:

```text
Portfolio dashboard
1. Header with CTA back into properties table
2. Four-up summary metric row
3. Two-by-two card grid for charts and ranked lists
4. Narrative state card for fast answers
```

Design emphasis:

- Keep this page concise and directional.
- It should point users toward action rather than compete with analytics.

### Triage Inbox

Intent:

- Prioritize degraded properties, failed runs, unread notifications, and missing setup.

Current implementation anchors:

- severity filter toolbar
- single work-items card with stacked priority rows
- inline actions for open property, open run, run now, and mark reviewed

Suggested wireframe:

```text
Triage inbox
1. Page intro and severity filter strip
2. Prioritized work list
3. Each card: title, detail, severity, timestamp, direct actions
```

Design emphasis:

- Make severity ordering visually unmistakable.
- Keep actions visible at the moment of decision.
- Optimize for repeated scanning during focused review sessions.

## Supporting Surfaces To Queue Next

After the five primary wireframes above, the next surfaces to define are:

- Runs list and run detail
- Sources list and source detail
- Fields library
- Alerts and notifications
- Settings and admin

## Figma Build Order

Use this order so page work can proceed without rework:

1. Shell template with expanded and collapsed nav states
2. Page card and page-stack composition rules
3. Properties list wireframe
4. Property detail wireframe
5. Analytics workbench wireframe
6. Dashboard and triage wireframes
7. Secondary admin and operations surfaces

## Related Docs

- [Design Brief](./design-brief.md)
- [Design System Brief](./design-system-brief.md)
- [UI Architecture](./ui-architecture.md)
- [Interaction Patterns](./interaction-patterns.md)