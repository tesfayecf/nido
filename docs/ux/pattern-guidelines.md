# UX Pattern Guidelines

## Forms

### Use
- Shared field, input, select, textarea, and action-group components for all standard form interactions.
- Specific save labels that describe scope, such as “Save profile” or “Save intake defaults”.
- Inline validation and inline failure feedback for blocked submissions.

### Avoid
- Generic save labels when a page contains multiple settings groups.
- Mixed native controls when a shared component already exists for the same input type.

## Navigation

### Use
- One primary path per destination.
- Row click for primary table navigation when the row is already interactive.
- Menus only for secondary or destructive actions.

### Avoid
- Repeating “Open” in both a row menu and a row-level primary affordance.

## Editing vs viewing

### Use
- Read-first screens when the primary task is review.
- Explicit edit entry points before exposing advanced or destructive actions.

### Avoid
- Simultaneously presenting multiple edit paths that change the same resource without clear hierarchy.

## Inline editing vs dialogs

### Use
- Dialogs for focused, short creation flows that need concentrated attention.
- Inline controls for fast, repeatable row actions.

### Avoid
- Dialogs that duplicate the same workflow language differently from inline or page-level entry points.

## Action feedback

### Use
- Success and error feedback for every mutation.
- Per-item loading states for per-item actions.
- Escape and outside-click dismissal for lightweight popovers and menus.

### Avoid
- Global pending states for local row actions.
- Silent failures or hidden state changes.

## First-time user guidance

### Use
- Dominant primary actions.
- Minimal required fields before revealing advanced options.
- Copy that explains what happens next in plain language.

### Avoid
- Requiring users to infer whether an action affects only the current item, the page, or device-local settings.
