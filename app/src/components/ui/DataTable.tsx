import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { classNames } from "@/lib/ui/classNames";

interface DataTableColumn<TItem> {
    readonly align?: "left" | "right";
    readonly cell?: (item: TItem) => ReactNode;
    readonly header: ReactNode;
    readonly id: string;
    readonly sortValue?: (item: TItem) => number | string;
    readonly width?: string;
    readonly wrap?: boolean;
}

interface DataTableProps<TItem> {
    readonly caption?: ReactNode;
    readonly className?: string;
    readonly columns: DataTableColumn<TItem>[];
    readonly compact?: boolean;
    readonly emptyMessage: string;
    readonly getRowId: (item: TItem) => string;
    readonly initialSortColumnId?: string;
    readonly initialSortDirection?: "asc" | "desc";
    readonly items: TItem[];
    readonly onRowClick?: (item: TItem) => void;
    readonly pageSize?: number;
    readonly rowLabel?: (item: TItem) => string;
}

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
    rowLabel,
}: DataTableProps<TItem>): JSX.Element => {
    const [page, setPage] = useState(0);
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

    const startIndex = page * pageSize;
    const pagedItems = sortedItems.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));

    useEffect(() => {
        setPage((current) => Math.min(current, Math.max(0, totalPages - 1)));
    }, [totalPages]);

    if (items.length === 0) {
        return <EmptyState message={emptyMessage} />;
    }

    return (
        <div className={classNames("data-table-shell", className)}>
            <table className={classNames("data-table", compact && "data-table--compact")}>
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
                <tbody>
                    {pagedItems.map((item) => {
                        const interactive = onRowClick !== undefined;
                        return (
                            <tr
                                aria-label={rowLabel?.(item)}
                                className={interactive ? "data-table__row data-table__row--interactive" : "data-table__row"}
                                key={getRowId(item)}
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
                    })}
                </tbody>
            </table>
            {totalPages > 1 ? (
                <div className={"data-table__pagination"}>
                    <span>{`Page ${page + 1} of ${totalPages}`}</span>
                    <div className={"action-group"}>
                        <Button disabled={page === 0} onClick={() => { setPage((current) => Math.max(0, current - 1)); }} size={"small"} variant={"secondary"}>{"Previous"}</Button>
                        <Button disabled={page >= totalPages - 1} onClick={() => { setPage((current) => Math.min(totalPages - 1, current + 1)); }} size={"small"} variant={"secondary"}>{"Next"}</Button>
                    </div>
                </div>
            ) : null}
        </div>
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
