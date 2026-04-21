# Property Detail

## Purpose
Configure selector-based extraction, preview values, and review snapshot history for one tracked property.

## Screenshot
![Property detail](../assets/property-detail.png)

## UI Elements
### Element: Property Settings
- Type: form
- Description: Shows URL, label, schedule interval, and retry policy.
- Behavior: Saves updates to the existing property record.

### Element: Extraction Configuration
- Type: repeatable form
- Description: Defines field names, CSS selectors, optional attributes, transforms, and required flags.
- Behavior: Adds or removes rows and saves a new config version.

### Element: Extraction Preview
- Type: result panel
- Description: Runs the current selector set against the target page without persisting state.
- Behavior: Shows success messaging, extracted values, or failures.

### Element: Snapshot History
- Type: timeline panel
- Description: Shows persisted extraction results for prior ingests.
- Behavior: Marks snapshots as valid or invalid and shows extracted values.

## User Actions
- Save configuration → The latest selector version is stored for future ingests.
- Run preview → The page displays extracted values for quick verification.
- Press Ingest now → A persisted snapshot is created and appears in history.
- Expect a visual DOM selector → Use manual CSS selectors instead; a visual selector is not implemented in the current UI.

## Navigation
- Previous: [Add Property](./10-add-property.md)
- Next: [Sources](./12-sources.md)
