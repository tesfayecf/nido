# Internal Design System

## Goal

Provide a shared component foundation for the Home Searcher frontend so product screens reuse the same tokens, controls, layouts, and state handling.

## Foundation

- `src/styles/tokens.css` owns semantic tokens for color, typography, spacing, control sizing, elevation, motion, and theme behavior.
- `src/styles/globals.css` owns the shared presentation layer for primitives and shell-level patterns.
- `src/hooks/useTheme.tsx` and `src/components/shell/ThemeToggle.tsx` remain the single source of truth for light, dark, and system theme selection.

## Primitive Library

`src/components/ui/` now contains the reusable building blocks for the application:

- Actions: `Button`
- Forms: `Field`, `FormGrid`, `Input`, `Textarea`, `Select`, `MultiSelect`, `Toggle`
- Layout: `PageStack`, `SplitLayout`, `ActionGroup`, `ItemList`, `ListRow`, `Toolbar`, `KeyValueGrid`
- Feedback and loading: `ErrorBanner`, `InlineSpinner`, `Skeleton`, `StatusBadge`, `ToastProvider`, `Tooltip`, `Preformatted`
- Navigation and structure: `Tabs`, `Dialog`, `DataTable`
- Visualization and assets: `SparklineChart`, `Icon`

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
