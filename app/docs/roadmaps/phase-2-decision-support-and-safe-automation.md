# Phase 2 Roadmap: Decision Support And Safe Automation

## Goal

Help users understand what changed, why it matters, and how to trust the system when automation is making tracking decisions across many properties.

## Why This Phase Matters

After Phase 1 improves operational speed, the next biggest value increase comes from improving understanding and confidence.

The app already stores:

- snapshots
- change flags
- property runs
- alerts
- notifications
- field-level analysis

But much of that value is still presented as raw data. This phase turns stored history into usable decision support.

## Primary User Outcomes

- Understand why an alert fired without reading raw snapshot payloads.
- Compare old and new values quickly.
- change selectors and configs with confidence.
- trust automation more because history is inspectable and reversible.

## Core Epics

### 1. Human-Readable Change Intelligence

Add richer comparison and interpretation around snapshots and runs.

Suggested additions:

- previous vs current value panels
- absolute and percentage deltas
- changed field summaries
- grouped “what changed in this run” cards
- field importance prioritization

Value:

- turns raw extraction history into operator insight
- reduces manual comparison work

### 2. Alerting 2.0

Expand the current alert system beyond the small initial rule set.

Suggested new alert types:

- missing required field
- repeated run failure
- stale property with no successful run in N hours or days
- field changed by more than a percentage
- field matched a text pattern
- any of selected fields changed
- all of selected conditions true
- per-tag rules
- per-source rules

Suggested controls:

- severity level
- mute or snooze
- delivery preference
- cooldown window

Value:

- moves the app from passive monitoring to proactive workflow automation

### 3. Config History, Diff, And Rollback

Treat extraction configuration as a first-class controlled asset.

Suggested capabilities:

- list config versions
- compare any two versions
- show which fields changed
- rollback to a prior version
- show which snapshots were generated under each config version

Value:

- makes experimentation safer
- reduces fear of breaking working properties

### 4. Source Health And Drift Detection

Expand the value of sources from template records into operational assets.

Suggested capabilities:

- success rate over time
- failing properties by source
- selector drift warnings
- field completeness by source
- “this template change affects N properties” preview

Value:

- helps prevent broad regressions
- makes source-level management meaningful

### 5. Notification Preferences And Delivery Controls

Build a proper preference center.

Suggested capabilities:

- quiet hours
- unread digests
- per-alert severity routing
- webhook, email, and chat delivery options
- per-property or per-tag mute rules

Value:

- makes notifications useful instead of noisy

### 6. Guided Selector And Template Onboarding

Improve setup and maintenance for non-expert users.

Suggested capabilities:

- setup wizard for a new property
- selector suggestions from HTML or prior templates
- test against sample pages
- template cloning and adaptation
- preview quality warnings before save

Value:

- reduces onboarding time
- lowers the skill threshold required to use the app effectively

## Recommended Deliverables

- run detail comparison panels
- enhanced alert-rule model and editor UX
- config version history UI
- source health dashboard or summary panels
- notification preference center in settings
- onboarding wizard for new property setup

## Suggested Success Metrics

- fewer manual rechecks after a notification fires
- fewer broken configs after edits
- higher alert usefulness and lower notification fatigue
- faster property onboarding time

## Dependencies

This phase likely needs meaningful backend additions:

- richer alert-rule evaluation and storage
- config history retrieval and rollback support
- source-level health summaries
- delivery-channel integration points
- richer change summary endpoints or reusable comparison logic

## Risks

- alerting can become noisy without severity and cooldown design
- rollback must be explicit and audit-friendly
- rich comparison UX can become overcomplicated if every field gets equal visual weight

## Definition Of Done

This phase is successful when users can answer these questions quickly:

- why did this alert happen?
- what changed since the last good run?
- is this config change safe?
- how do I undo a bad config update?