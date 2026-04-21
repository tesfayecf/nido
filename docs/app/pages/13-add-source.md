# Register Source

## Purpose
Create a new ingestion source using a raw backend-compatible payload editor.

## Screenshot
![Register source form](../assets/add-source.png)

## UI Elements
### Element: Preset selector
- Type: selector
- Description: Seeds kind, browser mode, and starter config for common source types.
- Behavior: Leaves id, name, and endpoint editable.

### Element: Source identity fields
- Type: inputs
- Description: Capture id, name, kind, and endpoint URL.
- Behavior: Define the persisted source record.

### Element: Policy fields
- Type: checkbox and numeric inputs
- Description: Control active state, browser rendering, rate limits, retries, schedules, and freshness windows.
- Behavior: Save directly to the source payload.

### Element: Config JSON
- Type: textarea
- Description: Holds source-specific connector configuration.
- Behavior: Accepts raw JSON sent to the backend.

## User Actions
- Select a preset → Default kind and config values update.
- Fill the editor and submit → The source is created and opened in detail mode.
- Leave required fields incomplete → Backend validation returns an error.

## Navigation
- Previous: [Sources](./12-sources.md)
- Next: [Source Detail](./14-source-detail.md)
