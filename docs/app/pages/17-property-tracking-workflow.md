# Property Tracking Workflow

## Purpose
Document the end-to-end operator workflow for adding a property, configuring selectors, validating extraction, and activating tracking.

## Screenshot
![Property workflow reference](../assets/property-detail.png)

## UI Elements
### Element: Add Property step
- Type: workflow step
- Description: Starts with the add-property form.
- Behavior: Creates a tracked property record from a target URL.

### Element: Manual selector configuration step
- Type: workflow step
- Description: Uses the repeatable extraction configuration rows in property detail.
- Behavior: Stores CSS selectors for fields such as title, price, and location.

### Element: Validation step
- Type: workflow step
- Description: Uses Run preview and Snapshot History.
- Behavior: Shows live extracted values before and after persisted ingest.

### Element: Monitoring step
- Type: workflow step
- Description: Uses the properties list and run history.
- Behavior: Shows property status, next run, last run, and downstream ingest evidence.

## User Actions
- Add a property in [Add Property](./10-add-property.md) → A new property detail route is created.
- Enter CSS selectors in [Property Detail](./11-property-detail.md) → Manual extraction rules are versioned.
- Run preview → Extracted values confirm whether the selectors match the page.
- Press Ingest now → Tracking becomes active through a persisted snapshot.
- Look for a visual DOM selector → This workflow does not exist in the current UI; the shipped product uses manual selector entry only.

## Navigation
- Previous: [Run Detail](./16-run-detail.md)
- Next: [Market Monitoring Workflow](./18-market-monitoring-workflow.md)
