# Property Detail

## Purpose
Configure selector-based extraction for one tracked property, review the guided builder, and inspect saved snapshots.

## Screenshot
![Property detail](../assets/property-detail.png)

## UI Elements
### Element: Property Settings
- Type: form
- Description: Shows URL, label, schedule interval, and retry policy.
- Behavior: Saves updates to the existing property record.

### Element: Extraction Configuration
- Type: structured form
- Description: Defines field names, selector types, selector values, extraction modes, optional attribute names, fallback selectors, and required flags.
- Behavior: Adds or removes selector cards and saves a new config version.

### Element: Extraction Preview
- Type: result panel
- Description: Runs the current selector set against the target page without persisting state.
- Behavior: Shows field-level readiness states, extracted values, or clear failures when the preview target is unavailable.

### Element: Current Snapshot
- Type: status panel
- Description: Shows the latest persisted extraction result for the property.
- Behavior: Displays the most recent run state, extracted values, and a manual run action.

## User Actions
- Save configuration → The latest selector version is stored for future ingests.
- Run preview → The page displays extracted values for quick verification when the preview target can be fetched.
- Press Ingest now → A persisted snapshot is created and appears in history.
- Expect a visual DOM selector → Use the structured manual builder instead; a visual selector is not implemented in the current UI.

## Navigation
- Previous: [Add Property](./10-add-property.md)
- Next: [Sources](./12-sources.md)
