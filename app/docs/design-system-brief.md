# Design System Brief

## Purpose

This document gives designers a component-level brief mapped to the current frontend foundations and reusable UI patterns.

## Context

The app already has a working token system, shell structure, and component library. The immediate design task is not to invent a new UI language from zero. It is to tighten hierarchy, improve consistency, and evolve the existing system into a coherent designer-facing library.

## System Goals

- Preserve the product's operational, data-first character.
- Keep components dense, calm, and highly legible.
- Support long-session use across light, dark, and system themes.
- Make states, feedback, and destructive actions unambiguous.
- Build a component set that maps cleanly to the current React primitives.

## Foundations

### Color Roles

Current token model is semantic rather than brand-heavy.

- primary / accent blue for focus and primary action
- slate and neutral surfaces for page structure and dense content areas
- semantic tones for success, warning, danger, and info
- separate border, shadow, overlay, and focus-ring tokens

Design guidance:

- Use semantic colors for meaning first, decoration second.
- Preserve strong contrast between background, surface, and muted surface layers.
- Avoid overusing accent blue; status color and layout contrast should do much of the work.

### Typography

Current foundation:

- font family: IBM Plex Sans based
- display and body currently share the same type family
- scale ranges from `0.75rem` to `2.125rem`

Design guidance:

- Keep type compact, precise, and editorial rather than promotional.
- Use hierarchy through weight, spacing, and placement before increasing font size.
- Favor short, explicit labels and utility copy.

### Spacing, Radius, Depth, Motion

Current foundation:

- spacing tokens range from `0.25rem` to `3.5rem`
- radius tokens are modest and squared-off rather than soft consumer rounded
- shadows are restrained and support separation more than drama
- motion durations are fast and subtle

Design guidance:

- Maintain a crisp operational rhythm.
- Use space to separate blocks of work, not to create airy emptiness.
- Keep overlays, menus, and dialogs visually elevated but not theatrical.

### Layout Constants

Current shell constants:

- nav width: `15rem`
- collapsed nav width: `3.5rem`
- shell header height: `3.25rem`
- content containers: `48rem`, `64rem`, `80rem`

Design guidance:

- Build page templates around these shell dimensions first.
- Use wider compositions selectively for tables and analytics.
- Default to desktop-first layouts, then define careful tablet and mobile compression paths.

## Shell System

### App Shell

Current implementation includes:

- `AppShell` for stable chrome and routed content
- `AppNav` for grouped navigation
- `AppHeader` for breadcrumb, page title, and shell utilities
- skip link and mobile nav backdrop behavior

Design guidance:

- The shell should communicate orientation and reliability.
- Expanded, collapsed, and mobile-overlay states should all feel intentional.
- Navigation grouping is a product decision surface, not just a menu.

### Theme System

Current implementation includes:

- light, dark, and system theme support
- segmented `ThemeToggle` control with radio semantics
- current visible placements on login and settings surfaces

Design guidance:

- Keep all three theme options in the system.
- If the toggle moves into the main shell later, treat it as a utility control, not a hero element.
- All tokens and states must remain legible in both light and dark themes.

## Component Layers

### 1. Page Structure

Primary primitives:

- `PageStack`: vertical page rhythm and section stacking
- `PageCard`: default dense panel with title, contextual help, action slot, and body
- `ActionGroup`: compact action clustering
- `KeyValueGrid` and `KeyValuePair`: structured summary facts
- `FormGrid`: multi-column form layout

Design guidance:

- Treat `PageCard` as the standard page module.
- Keep card headers compact and informative.
- Use summary grids for high-signal facts, not long prose.

### 2. Actions

Primary primitives:

- `Button` variants: `primary`, `secondary`, `ghost`, `destructive`
- `Button` sizes: `small`, `medium`, `large`
- inline icon-button pattern for compact shell and row actions
- `RowActions` and overflow menu for dense lists

Design guidance:

- Primary actions should be visually obvious without overpowering the page.
- Secondary and ghost buttons should preserve hierarchy in dense card headers and tables.
- Do not hide the primary next step inside an overflow menu.

### 3. Forms And Inputs

Primary primitives:

- `Field` with label, hint, error, dense mode, checkbox variant, and action variant
- `Input`, `Select`, and `Textarea`
- tabs for switching dense supporting views

Design guidance:

- Keep form labels concise and stable.
- Put helper copy outside the label and connect it with `aria-describedby` rather than folding helper copy into the accessible name.
- Use grouped fields and clear sectioning to reduce cognitive load in technical workflows like selector editing.

### 4. Data Display

Primary primitives:

- `DataTable` with sorting, pagination, compact mode, and row-click behavior
- `StatusBadge` with `neutral`, `success`, `warning`, and `danger` tones
- `TagBadge`
- `ItemList`, `ListRow`, and related summary-list patterns
- chart theming and analytics chart surfaces

Design guidance:

- Tables are a first-class product surface, not a fallback.
- Status should be readable through text, tone, and placement, not color alone.
- Make dense record displays feel organized through alignment, truncation rules, and consistent action placement.

### 5. Feedback And Overlays

Primary primitives:

- `Dialog`
- `ConfirmDialog`
- `ErrorBanner`
- `EmptyState`
- toast feedback via `ToastProvider`
- async loading, empty, and error handling patterns

Design guidance:

- Overlays should be focused and task-specific.
- Destructive confirmations need explicit labels and clear escape paths.
- Empty, loading, and error states should explain operational meaning, not just UI state.

### 6. Domain-Specific Shared Widgets

Current shared widgets worth designing intentionally:

- `SelectorBuilder` for extraction rule editing
- `DecisionStrip` for pricing and decision intelligence
- `AnalyticsChart` for interactive analytical views
- tag selection and alert creation flows

Design guidance:

- These components carry much of the product's differentiated value.
- They should feel more specialized than the base system without visually breaking away from it.

## Required Component States In Figma

Build these states early so page comps stay consistent:

- button: default, hover, focus, pressed, disabled, loading
- icon button: default, hover, focus, pressed, disabled
- field: default, filled, focus, error, disabled, with hint
- select and text input: default, focus, error, disabled
- status badge: neutral, success, warning, danger
- table header: default, sortable, active sort
- table row: default, hover, selected, keyboard focus, interactive
- dialog: default, destructive confirmation, long-form editor
- tabs: default, active, hover, focus
- theme toggle: light, dark, system, active, focus
- empty, loading, and error states

## Accessibility And Interaction Rules

- Keep accessible names stable because tests and usability both depend on them.
- Preserve keyboard access for navigation, tables, menus, dialogs, and theme controls.
- Dialogs must keep proper focus management and clear close affordances.
- Interactive rows need obvious focus styles in addition to hover styles.
- Do not rely on color alone for status, severity, or change.

## Figma Library Setup

Recommended file structure:

1. Foundations
2. Shell
3. Page structure
4. Actions
5. Forms
6. Data display
7. Feedback and overlays
8. Domain modules
9. Page templates

Recommended component build order:

1. tokens and semantic styles
2. shell and navigation
3. page cards and layout primitives
4. buttons, fields, inputs, selects, textareas
5. badges, chips, row actions, table primitives
6. dialogs, confirmations, empty and error states
7. analytics, selector builder, and decision-support modules

## Implementation Anchors

- shell: `app/src/app/AppShell.tsx`, `app/src/components/shell/AppNav.tsx`, `app/src/components/shell/AppHeader.tsx`
- theme: `app/src/hooks/useTheme.tsx`, `app/src/components/shell/ThemeToggle.tsx`
- tokens: `app/src/styles/tokens.css`
- page structure: `app/src/components/ui/PageStack.tsx`, `app/src/components/ui/PageCard.tsx`
- actions: `app/src/components/ui/Button.tsx`, `app/src/components/ui/RowActions.tsx`
- forms: `app/src/components/ui/Field.tsx`
- data display: `app/src/components/ui/DataTable.tsx`, `app/src/components/ui/StatusBadge.tsx`
- overlays: `app/src/components/ui/Dialog.tsx`

## Related Docs

- [Design Brief](./design-brief.md)
- [Page Inventory & Wireframes](./page-inventory.md)
- [Components](./components.md)
- [Interaction Patterns](./interaction-patterns.md)