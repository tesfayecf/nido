/**
 * File: app/src/components/ui/index.ts
 *
 * Purpose:
 * Provides a reusable design-system UI building block shared across feature workflows.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
export * from "@/components/ui/ActionGroup";
export * from "@/components/ui/AsyncContent";
export * from "@/components/ui/Button";
export * from "@/components/ui/ConfirmDialog";
export * from "@/components/ui/ContextualHelp";
export * from "@/components/ui/DataTable";
export * from "@/components/ui/Dialog";
export * from "@/components/ui/EmptyState";
export * from "@/components/ui/ErrorBanner";
export * from "@/components/ui/Field";
export * from "@/components/ui/FormGrid";
export * from "@/components/ui/Icon";
export * from "@/components/ui/Input";
export * from "@/components/ui/InlineSpinner";
export * from "@/components/ui/ItemList";
export * from "@/components/ui/KeyValueGrid";
export * from "@/components/ui/ListRow";
export * from "@/components/ui/MultiSelect";
export * from "@/components/ui/PageCard";
export * from "@/components/ui/PageStack";
export * from "@/components/ui/Preformatted";
export * from "@/components/ui/QueryDataTable";
export * from "@/components/ui/RowActions";
export * from "@/components/ui/Select";
export * from "@/components/ui/Skeleton";
export * from "@/components/ui/SparklineChart";
export * from "@/components/ui/SplitLayout";
export * from "@/components/ui/StatusBadge";
export * from "@/components/ui/Tabs";
export * from "@/components/ui/Textarea";
export * from "@/components/ui/ToastProvider";
export * from "@/components/ui/Toggle";
export * from "@/components/ui/Toolbar";
export * from "@/components/ui/Tooltip";
