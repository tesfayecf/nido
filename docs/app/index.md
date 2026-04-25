# Home Searcher Application Documentation

## How To Use This Manual
This manual follows the current UI served from `http://localhost:3000/` and documents the shipped frontend under `/app`. The copy is intentionally redacted: it explains the operator flow, the main controls, and the expected checks without repeating sample property names, ids, or record values shown in the screenshots.

## First-Time Start
1. Sign in from [01 Sign In](./pages/01-login.md).
2. Learn the shared shell in [02 Shell Navigation](./pages/02-shell-navigation.md).
3. Use [03 Getting Started](./pages/03-listings.md) to pick the fastest path into the app.
4. Follow [18 Property Tracking Tutorial](./pages/18-market-monitoring-workflow.md) when you need to onboard one tracked page.
5. Follow [19 Monitoring Tutorial](./pages/19-shared-ui-states.md) when you need a daily review loop across the portfolio.

## Reference Pages
- [01 Sign In](./pages/01-login.md)
- [02 Shell Navigation](./pages/02-shell-navigation.md)
- [03 Getting Started](./pages/03-listings.md)
- [04 Properties Workspace](./pages/04-listing-detail.md)
- [05 New Property](./pages/05-bookmarks.md)
- [06 Property Detail](./pages/06-watchlists.md)
- [07 Market Analysis](./pages/07-alerts.md)
- [08 Saved / Shortlist](./pages/08-notifications.md)
- [09 Alerts](./pages/09-properties.md)
- [10 Overview Dashboard](./pages/10-add-property.md)
- [11 Review Queue](./pages/11-property-detail.md)
- [12 Notifications](./pages/12-sources.md)
- [13 Sources](./pages/13-add-source.md)
- [14 Template Detail](./pages/14-source-detail.md)
- [15 Runs](./pages/15-runs.md)
- [16 Run Detail](./pages/16-run-detail.md)
- [17 Admin Surfaces](./pages/17-property-tracking-workflow.md)
- [18 Property Tracking Tutorial](./pages/18-market-monitoring-workflow.md)
- [19 Monitoring Tutorial](./pages/19-shared-ui-states.md)

## Coverage Notes
- Screenshots are stored locally in `/docs/app/assets`.
- Screenshot references in this manual were refreshed against `http://localhost:3000/`.
- Documentation reflects the shipped UI only and does not assume any seeded demo data.
- Selector tooling uses CSS, attribute, advanced XPath, and ordered fallback selectors.
- A visual DOM selector is not implemented in this UI.
