/**
 * File: app/src/components/ui/QueryDataTable.tsx
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
 * - Imports: @/components/ui/DataTable, @/components/ui/DataTable, @/components/ui/ErrorBanner, @/components/ui/Skeleton
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - @/components/ui/DataTable
 * - @/components/ui/ErrorBanner
 * - @/components/ui/Skeleton
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
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableProps } from "@/components/ui/DataTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";

interface QueryDataTableProps<TItem> extends DataTableProps<TItem> {
    readonly errorMessage: string;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly loadingMessage: string;
}

/**
 * Purpose: Renders the QueryDataTable UI boundary documented for app/src/components/ui/QueryDataTable.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const QueryDataTable = <TItem,>({
    caption,
    className,
    columns,
    compact,
    emptyMessage,
    errorMessage,
    getRowId,
    initialSortColumnId,
    initialSortDirection,
    isError,
    isLoading,
    items,
    loadingMessage,
    onRowClick,
    pageSize,
    pageSizeOptions,
    paginationStorageKey,
    rowLabel,
    virtualizeThreshold,
}: QueryDataTableProps<TItem>): JSX.Element => {
    if (isLoading) {
        return (
            <div aria-busy={"true"} className={"data-table-shell data-table-shell--skeleton"} role={"status"}>
                <span className={"sr-only"}>{loadingMessage}</span>
                <table className={compact === true ? "data-table data-table--compact" : "data-table"}>
                    {caption !== undefined ? <caption className={"sr-only"}>{caption}</caption> : null}
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th key={column.id} scope={"col"} style={column.width !== undefined ? { width: column.width } : undefined}>
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: Math.min(5, pageSize ?? 5) }, (_, rowIndex) => (
                            <tr className={"data-table__row"} key={rowIndex}>
                                {columns.map((column) => (
                                    <td key={`${rowIndex}-${column.id}`}>
                                        <div className={"data-table__cell-content"}>
                                            <Skeleton aria-hidden={"true"} className={"data-table__skeleton"} />
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (isError) {
        return <ErrorBanner>{errorMessage}</ErrorBanner>;
    }

    return (
        <DataTable
            caption={caption}
            className={className}
            columns={columns}
            compact={compact}
            emptyMessage={emptyMessage}
            getRowId={getRowId}
            initialSortColumnId={initialSortColumnId}
            initialSortDirection={initialSortDirection}
            items={items}
            onRowClick={onRowClick}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            paginationStorageKey={paginationStorageKey}
            rowLabel={rowLabel}
            virtualizeThreshold={virtualizeThreshold}
        />
    );
};
