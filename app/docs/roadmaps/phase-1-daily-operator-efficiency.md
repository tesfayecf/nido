# Phase 1 Roadmap: Daily Operator Efficiency

## Goal

Make the app dramatically faster and easier to use for the core daily workflow: checking many tracked properties, spotting what needs attention, and taking action with minimal navigation.

## Why This Phase Comes First

The current app already supports the full single-property workflow well:

- create and edit tracked properties
- configure selectors
- preview extraction
- save config versions
- run manual ingest
- inspect snapshots and property runs
- manage tags, bookmarks, alerts, notifications, and live events

What it still lacks is a strong multi-property operating layer. Users can manage one property deeply, but the app is not yet optimized for daily portfolio triage.

## Primary User Outcomes

- See what changed, failed, or needs action in under two minutes.
- Move from overview to action without opening multiple pages.
- Reduce repetitive clicks for common operations.
- Make the app feel like a control center, not a collection of screens.

## Core Epics

### 1. Portfolio Dashboard

Create a dedicated home/dashboard route that summarizes the workspace at a glance.

Suggested widgets:

- tracked properties total
- active, degraded, inactive, and pending counts
- failed runs in the last 24 hours
- unread notifications
- properties changed recently
- next scheduled runs
- top problematic sources

Value:

- turns the app into something users open first every day
- reduces time spent scanning tables manually

### 2. Saved Views And Priority Queues

Add reusable filtered views for the properties workspace.

Suggested views:

- Needs review
- Failing now
- No successful run yet
- Changed recently
- High priority
- Bookmarked
- By source
- By tag

Value:

- gives users repeatable operational slices
- reduces filter setup overhead every session

### 3. Triage Inbox

Create one page that consolidates operational work items.

Suggested item types:

- degraded properties
- failed runs
- selector failures
- repeated retries
- unread notifications
- properties missing required fields

Suggested actions:

- open property
- rerun now
- snooze
- mark reviewed
- filter by severity

Value:

- makes failure handling a first-class workflow
- eliminates context switching across Runs, Events, Properties, and Notifications

### 4. Bulk Actions

Add batch operations for common portfolio maintenance.

Suggested batch actions:

- bulk tag assignment
- bulk run now
- bulk schedule change
- bulk retry policy update
- bulk pause or deactivate
- bulk source reassignment

Value:

- improves scalability once the property count grows
- removes repetitive editing work

### 5. Global Search And Command Palette

Add keyboard-first navigation and action entry.

Suggested searches:

- properties
- sources
- runs
- tags
- notifications

Suggested commands:

- add property
- run property now
- open failing properties
- create alert
- open unread notifications

Value:

- speeds up expert usage
- improves perceived polish immediately

### 6. Better Live Operations View

Extend the current events page with real filtering and operator usefulness.

Suggested additions:

- filter by property, source, and event type
- severity grouping
- pinned events
- correlation between events and runs
- richer summaries than raw payload snippets

Value:

- makes the event feed practical instead of mostly diagnostic

## Recommended Deliverables

- new dashboard route and nav entry
- saved-view model for the properties page
- triage queue route
- first batch action bar in properties table
- global search or command palette MVP
- filtered events page

## Suggested Success Metrics

- time to identify urgent issues decreases significantly
- number of clicks to trigger common actions decreases
- users spend more time in dashboard/triage and less time manually inspecting multiple lists
- bulk actions are adopted for recurring operational tasks

## Dependencies

Mostly frontend-driven, but some backend support would add value:

- denormalized dashboard counts
- filtered event history beyond in-memory session state
- optional triage summary endpoints

## Risks

- adding a dashboard without clear prioritization could create visual noise
- too many batch actions can make destructive workflows riskier
- event filtering needs careful wording so users do not confuse observability with persisted audit history

## Definition Of Done

This phase is successful when a user can open the app and answer these questions immediately:

- what is broken?
- what changed?
- what needs action now?
- what can I fix in one or two clicks?