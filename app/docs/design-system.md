# Internal Design System

## Goal

Provide a shared component foundation for the Home Searcher frontend so product screens reuse the same tokens, controls, layouts, and state handling.

## Foundation

- `src/styles/tokens.css` owns semantic tokens for color, typography, spacing, control sizing, elevation, motion, and theme behavior.
- `src/styles/globals.css` owns the shared presentation layer for primitives and shell-level patterns.
- `src/hooks/useTheme.tsx` and `src/components/shell/ThemeToggle.tsx` remain the single source of truth for light, dark, and system theme selection.

## Design Principles

- Operational clarity over ornament. Tables, badges, timestamps, and action labels should explain system state before they try to impress.
- Dense, predictable layouts. Repeated panels should feel structurally similar so operators can scan quickly.
- Shared primitives before one-off markup. If a screen needs a common interaction pattern, add or extend a primitive rather than cloning custom HTML and CSS.
- Status is semantic. Success, warning, danger, idle, and draft states should map to stable component behavior and token usage.
- Accessibility is part of the component contract. Keep helper copy outside form labels and connect it with `aria-describedby` so accessible names stay stable for users and tests.
- Tokens before bespoke CSS. Most visual changes should start in `tokens.css`, not in route-local selectors.

## Primitive Library

`src/components/ui/` now contains the reusable building blocks for the application:

- Actions: `Button`
- Async state: `AsyncContent`, `EmptyState`, `ErrorBanner`, `InlineSpinner`, `Skeleton`, `ToastProvider`
- Confirmation and inspection: `ConfirmDialog`, `CopyButton`, `Dialog`, `Preformatted`, `Tooltip`
- Forms: `Field`, `FormGrid`, `Input`, `Textarea`, `Select`, `MultiSelect`, `Toggle`
- Layout: `PageCard`, `PageStack`, `SplitLayout`, `ActionGroup`, `ItemList`, `ListRow`, `Toolbar`, `KeyValueGrid`
- Navigation and structure: `Tabs`, `DataTable`, `RowActions`
- Feedback and status: `StatusBadge`
- Visualization and assets: `SparklineChart`, `Icon`

## Primitive Selection Guide

| Use | Preferred primitive | Reason |
| --- | --- | --- |
| Route section with a title and bounded content | `PageCard` | Keeps page composition dense and consistent |
| Tabular operational data | `DataTable` + `RowActions` | Preserves alignment, empty states, and action placement |
| Filter and action bars above lists | `Toolbar` + `ActionGroup` | Keeps high-frequency controls aligned and compact |
| Destructive confirmation | `ConfirmDialog` | Makes permanent actions explicit |
| Remote loading, empty, and error handling | `AsyncContent`, `ErrorBanner`, `EmptyState`, `InlineSpinner` | Prevents each feature from inventing its own async-state language |
| Status display | `StatusBadge` | Keeps severity and operational state consistent across routes |

## Migration Rules

- Prefer component primitives over ad-hoc `button`, `field`, `item-list`, `list-row`, `action-group`, and `key-value-grid` markup.
- Keep feature modules responsible for business logic and state orchestration only.
- Route all new styling through shared tokens and component classes instead of one-off selectors.
- Reuse async states through `AsyncContent`, `ErrorBanner`, and shared loading primitives.
- Add future components to `src/components/ui/` before introducing new UI patterns in feature code.

## Current Rollout

The authenticated shell, login flow, selector builder, property management, run management, source templates, alerts, bookmarks, notifications, and live events panel now consume the shared primitives.

## Next Steps

- Replace remaining raw layout/action markup inside future feature work with the corresponding primitive.
- Extend tests alongside any new design-system component behavior.
- Keep table, dialog, tabs, toast, and chart usage consistent by reusing the new primitives instead of introducing new libraries.
