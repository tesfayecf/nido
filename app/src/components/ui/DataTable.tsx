/**
 * File: app/src/components/ui/DataTable.tsx
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
 * - Imports: react, @tanstack/react-virtual, @/components/ui/Button, @/components/ui/EmptyState, @/lib/ui/classNames, @/lib/ui/scroll, @/lib/ui/sessionStorage
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-virtual
 * - @/components/ui/Button
 * - @/components/ui/EmptyState
 * - @/lib/ui/classNames
 * - @/lib/ui/scroll
 * - @/lib/ui/sessionStorage
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
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { classNames } from "@/lib/ui/classNames";
import { scrollToTop } from "@/lib/ui/scroll";
import { readSessionStorageNumber } from "@/lib/ui/sessionStorage";

const COMPACT_ROW_HEIGHT = 30;
const DEFAULT_ROW_HEIGHT = 38;

/**
 * Purpose: Renders the DataTableColumn UI boundary documented for app/src/components/ui/DataTable.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export interface DataTableColumn<TItem> {
    readonly align?: "left" | "right";
    readonly cell?: (item: TItem) => ReactNode;
    readonly header: ReactNode;
    readonly id: string;
    readonly sortValue?: (item: TItem) => number | string;
    readonly width?: string;
    readonly wrap?: boolean;
}

/**
 * Purpose: Renders the DataTableProps UI boundary documented for app/src/components/ui/DataTable.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export interface DataTableProps<TItem> {
    readonly caption?: ReactNode;
    readonly className?: string;
    readonly columns: DataTableColumn<TItem>[];
    readonly compact?: boolean;
    readonly emptyMessage: string;
    readonly getRowId: (item: TItem) => string;
    readonly initialSortColumnId?: string | null;
    readonly initialSortDirection?: "asc" | "desc";
    readonly items: TItem[];
    readonly onRowClick?: (item: TItem) => void;
    readonly pageSize?: number;
    readonly pageSizeOptions?: number[];
    readonly paginationStorageKey?: string;
    readonly rowLabel?: (item: TItem) => string;
    readonly virtualizeThreshold?: number;
}

/**
 * Purpose: Renders the DataTable UI boundary documented for app/src/components/ui/DataTable.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const DataTable = <TItem,>({
    caption,
    className,
    columns,
    compact = false,
    emptyMessage,
    getRowId,
    initialSortColumnId = null,
    initialSortDirection = "asc",
    items,
    onRowClick,
    pageSize = 10,
    pageSizeOptions = [10, 20, 50, 100],
    paginationStorageKey,
    rowLabel,
    virtualizeThreshold = 50,
}: DataTableProps<TItem>): JSX.Element => {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [page, setPage] = useState(() => readSessionStorageNumber(paginationStorageKey === undefined ? undefined : `${paginationStorageKey}:page`, 0, { allowZero: true }));
    const [currentPageSize, setCurrentPageSize] = useState(() => readSessionStorageNumber(paginationStorageKey === undefined ? undefined : `${paginationStorageKey}:page-size`, pageSize));
    const [sortColumnId, setSortColumnId] = useState<string | null>(initialSortColumnId);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialSortDirection);

    const sortedItems = useMemo(() => {
        if (sortColumnId === null) {
            return items;
        }

        const column = columns.find((candidate) => candidate.id === sortColumnId);
        if (column?.sortValue === undefined) {
            return items;
        }

        return [...items].sort((left, right) => {
            const leftValue = column.sortValue?.(left) ?? "";
            const rightValue = column.sortValue?.(right) ?? "";
            if (leftValue === rightValue) {
                return 0;
            }

            const order = leftValue > rightValue ? 1 : -1;
            return sortDirection === "asc" ? order : -order;
        });
    }, [columns, items, sortColumnId, sortDirection]);

    const startIndex = page * currentPageSize;
    const pagedItems = sortedItems.slice(startIndex, startIndex + currentPageSize);
    const totalPages = Math.max(1, Math.ceil(sortedItems.length / currentPageSize));
    const shouldVirtualize = pagedItems.length > virtualizeThreshold;
    const estimatedRowHeight = compact ? COMPACT_ROW_HEIGHT : DEFAULT_ROW_HEIGHT;
    const rowVirtualizer = useVirtualizer({
        count: pagedItems.length,
        estimateSize: () => estimatedRowHeight,
        getScrollElement: () => scrollRef.current,
        initialRect: { height: Math.min(pagedItems.length, currentPageSize) * estimatedRowHeight, width: 0 },
        overscan: 8,
    });
    const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
    const visibleRows = shouldVirtualize
        ? virtualRows.length > 0
            ? virtualRows.flatMap((virtualRow) => {
                const item = pagedItems[virtualRow.index];
                return item === undefined ? [] : [{ item, virtualRow }];
            })
            : pagedItems.slice(0, Math.min(pagedItems.length, 20)).map((item, index) => ({
                item,
                virtualRow: { start: index * estimatedRowHeight },
            }))
        : pagedItems.map((item) => ({ item, virtualRow: null }));

    useEffect(() => {
        setPage((current) => Math.min(current, Math.max(0, totalPages - 1)));
    }, [totalPages]);

    useEffect(() => {
        if (paginationStorageKey !== undefined) {
            sessionStorage.setItem(`${paginationStorageKey}:page`, `${page}`);
            sessionStorage.setItem(`${paginationStorageKey}:page-size`, `${currentPageSize}`);
        }
    }, [currentPageSize, page, paginationStorageKey]);

    if (items.length === 0) {
        return <EmptyState message={emptyMessage} />;
    }

    return (
        <div className={classNames("data-table-shell", className)} ref={scrollRef}>
            <table className={classNames("data-table", compact && "data-table--compact", shouldVirtualize && "data-table--virtual")}>
                {caption !== undefined ? <caption className={"sr-only"}>{caption}</caption> : null}
                <thead>
                    <tr>
                        {columns.map((column) => {
                            const sortable = column.sortValue !== undefined;
                            const active = column.id === sortColumnId;
                            return (
                                <th className={classNames(column.align === "right" && "data-table__cell--right")} key={column.id} scope={"col"} style={column.width !== undefined ? { width: column.width } : undefined}>
                                    {sortable ? (
                                        <button
                                            className={active ? "data-table__sort data-table__sort--active" : "data-table__sort"}
                                            onClick={() => {
                                                if (active) {
                                                    setSortDirection((current) => current === "asc" ? "desc" : "asc");
                                                    return;
                                                }

                                                setSortColumnId(column.id);
                                                setSortDirection("asc");
                                            }}
                                            type={"button"}
                                        >
                                            {column.header}
                                        </button>
                                    ) : column.header}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody style={shouldVirtualize ? { height: `${rowVirtualizer.getTotalSize()}px` } : undefined}>
                    {visibleRows.map(({ item, virtualRow }) => (
                        <DataTableRow
                            columns={columns}
                            getRowId={getRowId}
                            item={item}
                            key={getRowId(item)}
                            onRowClick={onRowClick}
                            rowLabel={rowLabel}
                            virtualStart={virtualRow?.start}
                        />
                    ))}
                </tbody>
            </table>
            {totalPages > 1 ? (
                <div className={"data-table__pagination"}>
                    <span>{`Page ${page + 1} of ${totalPages} · ${sortedItems.length} rows`}</span>
                    <div className={"action-group"}>
                        <label className={"data-table__page-size"}>
                            <span>{"Rows"}</span>
                            <select
                                onChange={(event) => {
                                    setCurrentPageSize(Number(event.target.value));
                                    setPage(0);
                                    scrollToTop(scrollRef.current);
                                }}
                                value={currentPageSize}
                            >
                                {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </label>
                        <Button
                            disabled={page === 0}
                            onClick={() => {
                                setPage((current) => Math.max(0, current - 1));
                                scrollToTop(scrollRef.current);
                            }}
                            size={"small"}
                            variant={"secondary"}
                        >
                            {"Previous"}
                        </Button>
                        <Button
                            disabled={page >= totalPages - 1}
                            onClick={() => {
                                setPage((current) => Math.min(totalPages - 1, current + 1));
                                scrollToTop(scrollRef.current);
                            }}
                            size={"small"}
                            variant={"secondary"}
                        >
                            {"Next"}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

interface DataTableRowProps<TItem> {
    readonly columns: DataTableColumn<TItem>[];
    readonly getRowId: (item: TItem) => string;
    readonly item: TItem;
    readonly onRowClick?: (item: TItem) => void;
    readonly rowLabel?: (item: TItem) => string;
    readonly virtualStart?: number;
}

const DataTableRow = <TItem,>({ columns, getRowId, item, onRowClick, rowLabel, virtualStart }: DataTableRowProps<TItem>): JSX.Element => {
    const interactive = onRowClick !== undefined;

    return (
        <tr
            aria-label={rowLabel?.(item)}
            className={classNames(interactive ? "data-table__row data-table__row--interactive" : "data-table__row", virtualStart !== undefined && "data-table__virtual-row")}
            data-index={getRowId(item)}
            onClick={(event) => {
                if (isEventFromInteractiveElement(event.target)) {
                    return;
                }

                onRowClick?.(item);
            }}
            onKeyDown={(event) => {
                if (!interactive) {
                    return;
                }

                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRowClick(item);
                }
            }}
            style={virtualStart !== undefined ? { transform: `translateY(${virtualStart}px)` } : undefined}
            tabIndex={interactive ? 0 : undefined}
        >
            {columns.map((column) => {
                const cellClassName = classNames(
                    column.align === "right" && "data-table__cell--right",
                    column.wrap === true ? "data-table__cell--wrap" : "data-table__cell--truncate",
                );
                return (
                    <td className={cellClassName} key={column.id} style={column.width !== undefined ? { width: column.width } : undefined}>
                        <div className={column.wrap === true ? "data-table__cell-content data-table__cell-content--wrap" : "data-table__cell-content"}>
                            {column.cell?.(item)}
                        </div>
                    </td>
                );
            })}
        </tr>
    );
};

const INTERACTIVE_SELECTOR = [
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[role='checkbox']",
    "[role='link']",
    "[role='menuitem']",
    "[role='radio']",
    "[role='switch']",
].join(", ");

const isEventFromInteractiveElement = (target: EventTarget | null): boolean => {
    return target instanceof HTMLElement && target.closest(INTERACTIVE_SELECTOR) !== null;
};
