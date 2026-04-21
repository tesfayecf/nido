# Source Detail

## Purpose
Edit an existing ingestion source and review its runtime timestamps.

## Screenshot
![Source detail](../assets/source-detail.png)

## UI Elements
### Element: Source editor
- Type: form
- Description: Shows the stored source payload with the id locked in edit mode.
- Behavior: Saves changes through the backend upsert route.

### Element: Ingest now
- Type: button
- Description: Triggers immediate execution for the displayed source.
- Behavior: Creates a new run and updates runtime metadata after completion.

### Element: Runtime Metadata
- Type: data panel
- Description: Shows created, updated, last-run, and next-run timestamps.
- Behavior: Reflects backend source record values.

## User Actions
- Edit source fields and save → The backend source record updates.
- Trigger Ingest now → A new run can be inspected from the runs pages.
- Review timestamps → Operators can verify whether the source has executed recently.

## Navigation
- Previous: [Register Source](./13-add-source.md)
- Next: [Runs](./15-runs.md)
