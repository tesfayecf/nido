# Nido: Next Feature Recommendations And Robustness Review

Date: 2026-04-26

## Assessment

I logged into the live app and sampled Properties, Property Detail, Overview, Review Queue, Bookmarks, Alerts, Admin, and Analytics, plus the local API. The overall product shape is good. It already behaves like an acquisition workspace rather than a generic listings browser, which matches [app/docs/UI_UX_SPEC.md](../../app/docs/UI_UX_SPEC.md) and [app/docs/architecture.md](../../app/docs/architecture.md). The strongest surfaces today are the properties list, the dashboard, and triage: they already support dense scanning, quick actions, saved views, and a useful daily workflow.

The main product gap is that the app is stronger at setup and operations than at decision support. For a solo buyer, that means you can track properties, but the app still does less than it could to answer: why is this property interesting, how has the case changed, and what should I do next? The existing roadmap already points in the right direction in [app/docs/roadmaps/phase-1-daily-operator-efficiency.md](../../app/docs/roadmaps/phase-1-daily-operator-efficiency.md) and [app/docs/roadmaps/phase-2-decision-support-and-safe-automation.md](../../app/docs/roadmaps/phase-2-decision-support-and-safe-automation.md). Most of [app/docs/roadmaps/phase-3-collaboration-and-platform-expansion.md](../../app/docs/roadmaps/phase-3-collaboration-and-platform-expansion.md) should stay deferred for now.

One immediate issue needs hardening before the insight layer expands: the Analytics page is broken in the current runtime. The frontend route in [app/src/features/analytics/AnalyticsPage.tsx](../../app/src/features/analytics/AnalyticsPage.tsx) fails because the backend dataset query in [server/internal/platform/sqlite/field_store.go](../../server/internal/platform/sqlite/field_store.go#L367) returns a 500 when `source_id` is null. By contrast, bookmarks, alerts, notifications, runs, and platform summary are healthy and simply empty.

## Best Next Features

### 1. Surface buyer decision context in the main workflow

The data model already supports priority, target price, expected rent, expected yield, acquisition notes, and deal thesis in [app/src/services/properties/properties.types.ts](../../app/src/services/properties/properties.types.ts#L43). The properties page already uses below-target logic in [app/src/features/properties/PropertiesPage.tsx](../../app/src/features/properties/PropertiesPage.tsx#L308).

Recommendation:

- promote this into the default row and detail experience
- add a compact decision strip with target gap, yield, stage, confidence, and thesis summary
- keep these signals visible without requiring the user to open admin-style or edit-heavy flows

Why this matters:

- it adds immediate value for a solo buyer
- it converts the app from a tracker into a decision aid without adding much UI complexity

### 2. Build human-readable change intelligence on top of snapshots

This is the highest-value addition for the current use case. Each property should answer:

- what changed
- by how much
- when it changed
- whether the change strengthens or weakens the case

Good first version:

- price delta
- `€/m²` delta
- availability or listing-status change
- missing key fields
- freshness since last good run

Why this matters:

- the app already stores history, but it is still closer to raw operational data than decision support
- this will reduce manual comparison and make alerts more meaningful

### 3. Add guided intake and readiness

The triage page already surfaced a useful friction point: a property that needs a source template. Turn property creation into a lightweight readiness flow.

Suggested checks:

- source matched
- selectors minimally valid
- first successful run completed
- key fields mapped
- analytics-ready status visible

Why this matters:

- it keeps onboarding simple for single-user usage
- it prevents half-configured properties from silently degrading portfolio quality

### 4. Turn bookmarks into a real shortlist

The current bookmarks page works, but it is still thin. For a solo buyer, shortlist should be the personal decision board.

Suggested additions:

- shortlist reason
- conviction level
- next review date
- compact compare view for 2 to 5 properties

Why this matters:

- it fits the current single-user posture
- it adds real value without moving into team collaboration yet

### 5. Fix and narrow Market Analysis before broadening it

Once analytics is healthy, keep the first useful analysis layer focused.

Suggested views:

- price distribution
- `€/m²` by location slice
- below-target opportunities
- top movers
- volatility over time

Avoid:

- turning it into a broad public-search product
- reviving map or listing-explorer concepts too early

Why this matters:

- the current product is strongest when it stays close to tracked-property decisions
- a narrow analytics scope will be easier to trust and easier to maintain

### 6. Expand alerts carefully

The current alerts page is a good foundation. The next useful rules are:

- price below target
- meaningful price change
- stale listing or no successful run for a given period
- status change

Why this matters:

- a small alert set that stays trustworthy is better than a large noisy rule engine
- alert usefulness is more important than feature breadth

### 7. Simplify navigation for the single-user stage

Daily value currently lives in:

- Properties
- Overview
- Review Queue
- Shortlist
- Alerts
- Settings

Pages like Admin, Sources, Fields, Runs, and Tags should feel like setup or diagnostics, not the primary workflow.

Recommendation:

- progressively disclose advanced pages
- preserve the acquisition-workspace posture instead of exposing too much internal-tool surface by default

## Robustness

### Backend and product robustness priorities

#### 1. Fix null-safe analytics export

The backend route for analytics is currently broken because [server/internal/platform/sqlite/field_store.go](../../server/internal/platform/sqlite/field_store.go#L367) scans `p.source_id` into a plain string even when it can be null.

Required follow-up:

- make the dataset export null-safe
- add regression coverage around nullable fields
- test partially configured properties explicitly

Why this matters:

- one incomplete property should not break an entire user-facing page

#### 2. Reduce client-side fanout as portfolio size grows

Dashboard, triage, and large property views currently compose several list endpoints on the client. That is acceptable at small scale, but it will get slower and more fragile as the number of properties grows.

Recommendation:

- add denormalized summary endpoints or read models for dashboard and triage
- reduce repeated secondary lookups where the backend can provide a stable summary shape

#### 3. Tighten runtime and config truth

The server docs already note settings that are parsed but not fully wired in [server/docs/architecture.md](../../server/docs/architecture.md) and [server/docs/local-development.md](../../server/docs/local-development.md).

Recommendation:

- either wire those settings fully
- or stop presenting them as if they shape runtime behavior today

Why this matters:

- configuration ambiguity becomes operational debt quickly

#### 4. Persist more audit and change history where trust matters

SSE is appropriate for visibility, but future product trust will come from durable history around:

- config changes
- runs
- notification deliveries
- important property-state transitions

Why this matters:

- as soon as the app becomes a real daily tool, inspectable history matters more than transient live status

### DevOps and deployment readiness

The current Docker image upload flow is acceptable for now. The next improvements should stay boring and operationally useful.

Recommended next steps:

- versioned images
- health-check-gated deploys
- automatic post-deploy smoke tests
- SQLite backup and restore drills
- structured logs
- lightweight error monitoring
- proper secret management

Why this matters:

- the current single-server approach is fine
- predictability and recoverability matter more than infrastructure sophistication at this stage

### Data durability as the first future-platform decision

Before thinking about broader platform expansion, make sure deploy, restore, and rollback are predictable for the current SQLite-based deployment.

This matters more than new integrations or team features in the near term.

## Suggested Priority Order

1. Fix analytics reliability and null-safe dataset export.
2. Surface decision metadata in Properties and Property Detail.
3. Add human-readable change intelligence.
4. Improve property intake and readiness.
5. Upgrade bookmarks into a real shortlist.
6. Expand alerts with a small, high-signal rule set.
7. Add denormalized backend summaries for dashboard and triage.
8. Keep platform/admin expansion secondary until the single-user workflow is clearly excellent.

## Closing View

The current app already has the right backbone for a strong single-user house-buying workspace. The best next moves are not broad new modules. They are focused improvements that make the product easier to trust, easier to scan, and more helpful for decisions.

The highest-value path is:

- keep the core workflow simple
- strengthen insight and interpretation
- harden analytics and backend summary behavior
- delay most collaboration and platform expansion until the single-user workflow feels complete