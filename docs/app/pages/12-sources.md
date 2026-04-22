# Sources

## Purpose
List reusable source templates and jump into the selector builder for each one.

## Screenshot
![Sources list](../assets/sources.png)

## UI Elements
### Element: Source rows
- Type: interactive list
- Description: Shows the template name, id, updated timestamp, and edit/delete actions.
- Behavior: Opens the template builder for review or maintenance.

### Element: Create template
- Type: link
- Description: Opens create mode for a new reusable selector template.
- Behavior: Navigates to `/sources/new`.

### Element: Live Events panel
- Type: status panel
- Description: Shows SSE connection state for backoffice operations.
- Behavior: Displays recent event payloads when received.

## User Actions
- Open a template row → The template builder loads.
- Press Create template → A new template starts with guided selector fields.
- Open the page with no templates → The empty state explains creation as the next step.

## Navigation
- Previous: [Property Detail](./11-property-detail.md)
- Next: [Create Template](./13-add-source.md)
