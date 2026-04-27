import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { readWorkspaceSettings } from "@/features/settings/workspaceSettings";
import { formatDateTime } from "@/lib/format/date";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { ingestProperty, listProperties, listPropertySummaries } from "@/services/properties/properties.service";
import type { Property, PropertyStatus, PropertySummary } from "@/services/properties/properties.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags } from "@/services/tags/tags.service";
import { buildPriceIntelligence } from "@/features/properties/priceIntelligence";
import { formatCurrency } from "@/lib/format/currency";
import {
    readPropertiesTableState,
    writePropertiesTableState,
    type NumericRangeFilter,
    type PropertiesTableState,
} from "@/features/properties/propertyTableState";

const TABLE_STORAGE_KEY = "nido.properties.table";
const MIN_COLUMN_WIDTH = 96;

interface PropertyRow {
    readonly bathrooms?: number;
    readonly id: string;
    readonly label: string;
    readonly location?: string;
    readonly opportunity: "cheap" | "expensive" | "fair" | "unranked";
    readonly price?: number;
    readonly pricePerSquareMeter?: number;
    readonly property: Property;
    readonly propertyAge?: number;
    readonly rooms?: number;
    readonly signal: string;
    readonly sizeSquareMeters?: number;
    readonly updatedAt?: string;
    readonly url: string;
}

interface PropertyColumn {
    readonly header: string;
    readonly id: string;
    readonly render: (row: PropertyRow) => JSX.Element | string;
    readonly sortValue: (row: PropertyRow) => number | string;
    readonly width: number;
}

const COLUMNS: readonly PropertyColumn[] = [
    { header: "Property", id: "property", render: (row) => row.label, sortValue: (row) => row.label.toLowerCase(), width: 240 },
    { header: "Price", id: "price", render: (row) => row.price === undefined ? "—" : formatMoney(row.price), sortValue: (row) => row.price ?? -1, width: 140 },
    { header: "sqm", id: "sizeSquareMeters", render: (row) => row.sizeSquareMeters === undefined ? "—" : `${formatNumber(row.sizeSquareMeters)} m²`, sortValue: (row) => row.sizeSquareMeters ?? -1, width: 120 },
    { header: "€/sqm", id: "pricePerSquareMeter", render: (row) => row.pricePerSquareMeter === undefined ? "—" : formatMoney(row.pricePerSquareMeter), sortValue: (row) => row.pricePerSquareMeter ?? -1, width: 140 },
    { header: "Rooms", id: "rooms", render: (row) => row.rooms === undefined ? "—" : formatNumber(row.rooms), sortValue: (row) => row.rooms ?? -1, width: 96 },
    { header: "Baths", id: "bathrooms", render: (row) => row.bathrooms === undefined ? "—" : formatNumber(row.bathrooms), sortValue: (row) => row.bathrooms ?? -1, width: 96 },
    { header: "Age", id: "propertyAge", render: (row) => row.propertyAge === undefined ? "—" : `${Math.round(row.propertyAge)}y`, sortValue: (row) => row.propertyAge ?? -1, width: 96 },
    { header: "Location", id: "location", render: (row) => row.location ?? "—", sortValue: (row) => row.location?.toLowerCase() ?? "", width: 180 },
    { header: "Opportunity", id: "opportunity", render: (row) => row.opportunity, sortValue: (row) => row.opportunity, width: 120 },
    { header: "Status", id: "status", render: (row) => row.property.status, sortValue: (row) => row.property.status, width: 110 },
    { header: "Change", id: "signal", render: (row) => row.signal, sortValue: (row) => row.signal, width: 220 },
    { header: "Updated", id: "updatedAt", render: (row) => row.updatedAt === undefined ? "—" : formatDateTime(row.updatedAt), sortValue: (row) => row.updatedAt ?? "", width: 160 },
];

const COLUMN_IDS = COLUMNS.map((column) => column.id);

export const PropertiesPage = (): JSX.Element => {
    const navigate = useNavigate();
    const workspaceSettings = useMemo(() => readWorkspaceSettings(), []);
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [columnMenuOpen, setColumnMenuOpen] = useState(false);
    const [sortColumnId, setSortColumnId] = useState<string>("price");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [dragColumnId, setDragColumnId] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [tableState, setTableState] = useState<PropertiesTableState>(() => readPropertiesTableState(TABLE_STORAGE_KEY, COLUMN_IDS));
    const resizeStateRef = useRef<{ readonly columnId: string; readonly startWidth: number; readonly startX: number; } | null>(null);

    const propertiesQuery = useQuery<Property[]>({
        queryFn: () => listProperties(),
        queryKey: propertyKeys.list(),
    });
    const summariesQuery = useQuery({
        queryFn: () => listPropertySummaries(),
        queryKey: propertyKeys.summaries(),
    });
    const propertyTagQueries = useQueries({
        queries: (propertiesQuery.data ?? []).map((property) => ({
            queryFn: () => listPropertyTags(property.id),
            queryKey: tagKeys.propertyTags(property.id),
        })),
    });
    const bookmarksQuery = useQuery({
        queryFn: listBookmarks,
        queryKey: bookmarkKeys.all(),
    });

    useEffect(() => {
        writePropertiesTableState(TABLE_STORAGE_KEY, tableState);
    }, [tableState]);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent): void => {
            const resizeState = resizeStateRef.current;
            if (resizeState === null) {
                return;
            }

            const nextWidth = Math.max(MIN_COLUMN_WIDTH, resizeState.startWidth + (event.clientX - resizeState.startX));
            setTableState((current) => ({
                ...current,
                widths: {
                    ...current.widths,
                    [resizeState.columnId]: nextWidth,
                },
            }));
        };
        const handleMouseUp = (): void => {
            resizeStateRef.current = null;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const bookmarkMutation = useMutation({
        mutationFn: async ({ isBookmarked, propertyId }: { readonly isBookmarked: boolean; readonly propertyId: string; }) => {
            if (isBookmarked) {
                await deleteBookmark(propertyId);
                return;
            }

            await createBookmark(propertyId);
        },
        onError() {
            pushToast("Could not update bookmark.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
        },
    });
    const ingestMutation = useMutation({
        mutationFn: (propertyId: string) => ingestProperty(propertyId),
        onError() {
            pushToast("Could not start the scrape run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.all() });
            pushToast("Scrape run started.", "success");
        },
    });

    const summariesById = useMemo(() => new Map((summariesQuery.data ?? []).map((summary) => [summary.property.id, summary])), [summariesQuery.data]);
    const bookmarkedIds = useMemo(() => new Set((bookmarksQuery.data ?? []).map((bookmark) => bookmark.property_id)), [bookmarksQuery.data]);
    const rows = useMemo(() => {
        const properties = propertiesQuery.data ?? [];
        return properties.map((property, index): PropertyRow => {
            const summary = summariesById.get(property.id);
            const price = readSummaryNumber(summary, ["price"]);
            const sizeSquareMeters = readSummaryNumber(summary, ["area_m2", "surface_area", "area"]);
            const pricePerSquareMeter = summary?.decision.current_price_per_sqm ?? (price !== undefined && sizeSquareMeters !== undefined && sizeSquareMeters > 0 ? price / sizeSquareMeters : undefined);
            const opportunity = summary === undefined
                ? "unranked"
                : buildPriceIntelligence(summary, summariesQuery.data ?? [summary], workspaceSettings).classification;
            const tagNames = (propertyTagQueries[index]?.data ?? []).map((tag) => tag.name.toLowerCase());
            const signal = summary?.latest_change_summary
                ?? (bookmarkedIds.has(property.id)
                    ? "Saved"
                    : tagNames.includes("watch")
                        ? "Watch"
                        : "No recent price change");

            return {
                bathrooms: readSummaryNumber(summary, ["bathrooms"]),
                id: property.id,
                label: property.label.trim() !== "" ? property.label : property.url.trim() !== "" ? property.url : "Manual property",
                location: readSummaryText(summary, ["location", "district", "city"]),
                opportunity,
                price,
                pricePerSquareMeter,
                property,
                propertyAge: readSummaryNumber(summary, ["property_age"]),
                rooms: readSummaryNumber(summary, ["rooms", "bedrooms"]),
                signal,
                sizeSquareMeters,
                updatedAt: summary?.signals[0]?.observed_at ?? property.updated_at,
                url: property.url,
            } satisfies PropertyRow;
        });
    }, [bookmarkedIds, propertiesQuery.data, propertyTagQueries, summariesById, summariesQuery.data, workspaceSettings]);

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            const filters = tableState.filters;
            return matchesTextFilter(row.label, filters.property)
                && matchesTextFilter(row.location ?? "", filters.location)
                && matchesNumericRange(row.price, filters.price)
                && matchesNumericRange(row.sizeSquareMeters, filters.sizeSquareMeters)
                && matchesNumericRange(row.pricePerSquareMeter, filters.pricePerSquareMeter)
                && matchesExactNumber(row.rooms, filters.rooms)
                && matchesExactNumber(row.bathrooms, filters.bathrooms)
                && matchesNumericRange(row.propertyAge, filters.propertyAge)
                && matchesSelectFilter(row.property.status, filters.status)
                && matchesSelectFilter(row.opportunity, filters.opportunity);
        });
    }, [rows, tableState.filters]);

    const sortedRows = useMemo(() => {
        const column = COLUMNS.find((candidate) => candidate.id === sortColumnId);
        if (column === undefined) {
            return filteredRows;
        }

        return [...filteredRows].sort((left, right) => {
            const leftValue = column.sortValue(left);
            const rightValue = column.sortValue(right);
            if (leftValue === rightValue) {
                return 0;
            }

            const order = leftValue > rightValue ? 1 : -1;
            return sortDirection === "asc" ? order : -order;
        });
    }, [filteredRows, sortColumnId, sortDirection]);

    const visibleColumns = useMemo(() => {
        const hiddenIds = new Set(tableState.hiddenColumnIds);
        return tableState.orderedColumnIds
            .map((columnId) => COLUMNS.find((column) => column.id === columnId))
            .filter((column): column is PropertyColumn => column !== undefined && !hiddenIds.has(column.id));
    }, [tableState.hiddenColumnIds, tableState.orderedColumnIds]);

    const roomOptions = useMemo(() => buildDiscreteOptions(rows.map((row) => row.rooms)), [rows]);
    const bathroomOptions = useMemo(() => buildDiscreteOptions(rows.map((row) => row.bathrooms)), [rows]);
    const locationOptions = useMemo(() => {
        const locations = rows
            .map((row) => row.location)
            .filter((value): value is string => value !== undefined && value !== "");

        return Array.from(new Set(locations)).sort((left, right) => left.localeCompare(right));
    }, [rows]);

    return (
        <PageStack>
            <PageCard
                action={(
                    <div className={"action-group"}>
                        <div className={"properties-table__column-menu"}>
                            <Button onClick={() => { setColumnMenuOpen((open) => !open); }} variant={"secondary"}>
                                {"Columns"}
                            </Button>
                            {columnMenuOpen ? (
                                <div className={"properties-table__column-menu-popover"}>
                                    {COLUMNS.map((column) => {
                                        const checked = !tableState.hiddenColumnIds.includes(column.id);
                                        return (
                                            <label className={"properties-table__column-toggle"} key={column.id}>
                                                <input
                                                    checked={checked}
                                                    onChange={(event) => {
                                                        setTableState((current) => ({
                                                            ...current,
                                                            hiddenColumnIds: event.target.checked
                                                                ? current.hiddenColumnIds.filter((columnId) => columnId !== column.id)
                                                                : [...current.hiddenColumnIds, column.id],
                                                        }));
                                                    }}
                                                    type={"checkbox"}
                                                />
                                                <span>{column.header}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                        <Button onClick={() => { setFiltersOpen((open) => !open); }} variant={"secondary"}>
                            {filtersOpen ? "Hide filters" : "Filters"}
                        </Button>
                        <Button as={Link} iconBefore={<Icon name={"plus"} />} to={"/properties/new"}>
                            {"Add Property"}
                        </Button>
                    </div>
                )}
                description={"Price-first table view with filters tucked away until needed."}
                title={"Properties"}
            >
                {propertiesQuery.isError || summariesQuery.isError ? <ErrorBanner>{"Could not load the portfolio table."}</ErrorBanner> : null}
                {(propertiesQuery.isLoading || summariesQuery.isLoading) ? <p className={"state-message state-message--loading"}>{"Loading properties..."}</p> : null}
                {!propertiesQuery.isLoading && !summariesQuery.isLoading ? (
                    sortedRows.length === 0 && rows.length === 0 ? (
                        <p className={"muted-copy"}>{"No properties are being tracked yet."}</p>
                    ) : (
                        <div className={"properties-table__shell"}>
                            <table className={"properties-table"}>
                                <thead>
                                    <tr>
                                        {visibleColumns.map((column) => {
                                            const width = tableState.widths[column.id] ?? column.width;
                                            const active = sortColumnId === column.id;
                                            return (
                                                <th
                                                    draggable
                                                    key={column.id}
                                                    onDragOver={(event) => { event.preventDefault(); }}
                                                    onDragStart={() => { setDragColumnId(column.id); }}
                                                    onDrop={() => {
                                                        if (dragColumnId === null || dragColumnId === column.id) {
                                                            return;
                                                        }

                                                        setTableState((current) => reorderColumns(current, dragColumnId, column.id));
                                                        setDragColumnId(null);
                                                    }}
                                                    scope={"col"}
                                                    style={{ width }}
                                                >
                                                    <button
                                                        className={active ? "properties-table__sort properties-table__sort--active" : "properties-table__sort"}
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
                                                    <span
                                                        className={"properties-table__resize-handle"}
                                                        onMouseDown={(event) => {
                                                            resizeStateRef.current = {
                                                                columnId: column.id,
                                                                startWidth: width,
                                                                startX: event.clientX,
                                                            };
                                                        }}
                                                    />
                                                </th>
                                            );
                                        })}
                                        <th scope={"col"} style={{ width: 132 }}>{"Actions"}</th>
                                    </tr>
                                    {filtersOpen ? (
                                        <tr className={"properties-table__filters-row"}>
                                            {visibleColumns.map((column) => (
                                                <th key={`${column.id}-filter`} style={{ width: tableState.widths[column.id] ?? column.width }}>
                                                    {renderFilter(column.id, tableState, setTableState, {
                                                        bathroomOptions,
                                                        locationOptions,
                                                        roomOptions,
                                                    })}
                                                </th>
                                            ))}
                                            <th />
                                        </tr>
                                    ) : null}
                                </thead>
                                <tbody>
                                    {sortedRows.map((row) => {
                                        const isBookmarked = bookmarkedIds.has(row.id);
                                        return (
                                            <tr
                                                aria-label={`Open property ${row.label}`}
                                                className={"properties-table__row properties-table__row--interactive"}
                                                key={row.id}
                                                onClick={(event) => {
                                                    if (!isEventFromInteractiveElement(event.target)) {
                                                        void navigate(`/properties/${row.id}`);
                                                    }
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        void navigate(`/properties/${row.id}`);
                                                    }
                                                }}
                                                tabIndex={0}
                                            >
                                                {visibleColumns.map((column) => (
                                                    <td key={`${row.id}-${column.id}`}>
                                                        <div className={"properties-table__cell"}>
                                                            {renderColumnCell(column.id, row, column.render(row))}
                                                        </div>
                                                    </td>
                                                ))}
                                                <td>
                                                    <RowActions>
                                                        <Button as={Link} size={"small"} to={`/properties/${row.id}`} variant={"ghost"}>{"Open"}</Button>
                                                        <button
                                                            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark property"}
                                                            className={"icon-button"}
                                                            onClick={() => { bookmarkMutation.mutate({ isBookmarked, propertyId: row.id }); }}
                                                            type={"button"}
                                                        >
                                                            <Icon name={isBookmarked ? "bookmark-filled" : "bookmark"} />
                                                        </button>
                                                        {row.url.trim() !== "" ? (
                                                            <button
                                                                aria-label={"Run scrape"}
                                                                className={"icon-button"}
                                                                onClick={() => { ingestMutation.mutate(row.id); }}
                                                                type={"button"}
                                                            >
                                                                <Icon name={"play"} />
                                                            </button>
                                                        ) : null}
                                                    </RowActions>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : null}
            </PageCard>
        </PageStack>
    );
};

const renderColumnCell = (columnId: string, row: PropertyRow, value: JSX.Element | string): JSX.Element => {
    if (columnId === "opportunity") {
        return <StatusBadge tone={opportunityTone(row.opportunity)} value={String(value)} />;
    }
    if (columnId === "status") {
        return <StatusBadge tone={statusTone(row.property.status)} value={String(value)} />;
    }
    if (columnId === "property") {
        return (
            <div className={"data-table__primary"}>
                <strong>{row.label}</strong>
                <span className={"table-subcopy"}>{row.url.trim() !== "" ? row.url : "Manual property"}</span>
            </div>
        );
    }

    return <>{value}</>;
};

const renderFilter = (
    columnId: string,
    tableState: PropertiesTableState,
    setTableState: Dispatch<SetStateAction<PropertiesTableState>>,
    options: {
        readonly bathroomOptions: readonly string[];
        readonly locationOptions: readonly string[];
        readonly roomOptions: readonly string[];
    },
): JSX.Element | null => {
    switch (columnId) {
        case "property":
            return <input className={"field__control"} onChange={(event) => { setTableState((current) => ({ ...current, filters: { ...current.filters, property: event.target.value } })); }} placeholder={"Filter"} value={tableState.filters.property} />;
        case "location":
            return (
                <select className={"field__control"} onChange={(event) => { setTableState((current) => ({ ...current, filters: { ...current.filters, location: event.target.value } })); }} value={tableState.filters.location}>
                    <option value={""}>{"All"}</option>
                    {options.locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
                </select>
            );
        case "price":
            return <NumericFilter value={tableState.filters.price} onChange={(value) => { setTableState((current) => ({ ...current, filters: { ...current.filters, price: value } })); }} />;
        case "sizeSquareMeters":
            return <NumericFilter value={tableState.filters.sizeSquareMeters} onChange={(value) => { setTableState((current) => ({ ...current, filters: { ...current.filters, sizeSquareMeters: value } })); }} />;
        case "pricePerSquareMeter":
            return <NumericFilter value={tableState.filters.pricePerSquareMeter} onChange={(value) => { setTableState((current) => ({ ...current, filters: { ...current.filters, pricePerSquareMeter: value } })); }} />;
        case "propertyAge":
            return <NumericFilter value={tableState.filters.propertyAge} onChange={(value) => { setTableState((current) => ({ ...current, filters: { ...current.filters, propertyAge: value } })); }} />;
        case "rooms":
            return (
                <select className={"field__control"} onChange={(event) => { setTableState((current) => ({ ...current, filters: { ...current.filters, rooms: event.target.value } })); }} value={tableState.filters.rooms}>
                    <option value={""}>{"All"}</option>
                    {options.roomOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
            );
        case "bathrooms":
            return (
                <select className={"field__control"} onChange={(event) => { setTableState((current) => ({ ...current, filters: { ...current.filters, bathrooms: event.target.value } })); }} value={tableState.filters.bathrooms}>
                    <option value={""}>{"All"}</option>
                    {options.bathroomOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
            );
        case "status":
            return (
                <select className={"field__control"} onChange={(event) => { setTableState((current) => ({ ...current, filters: { ...current.filters, status: event.target.value } })); }} value={tableState.filters.status}>
                    <option value={""}>{"All"}</option>
                    <option value={"active"}>{"active"}</option>
                    <option value={"degraded"}>{"degraded"}</option>
                    <option value={"inactive"}>{"inactive"}</option>
                    <option value={"pending"}>{"pending"}</option>
                </select>
            );
        case "opportunity":
            return (
                <select className={"field__control"} onChange={(event) => { setTableState((current) => ({ ...current, filters: { ...current.filters, opportunity: event.target.value } })); }} value={tableState.filters.opportunity}>
                    <option value={""}>{"All"}</option>
                    <option value={"cheap"}>{"cheap"}</option>
                    <option value={"fair"}>{"fair"}</option>
                    <option value={"expensive"}>{"expensive"}</option>
                    <option value={"unranked"}>{"unranked"}</option>
                </select>
            );
        default:
            return null;
    }
};

const NumericFilter = ({
    onChange,
    value,
}: {
    readonly onChange: (value: NumericRangeFilter) => void;
    readonly value: NumericRangeFilter;
}): JSX.Element => (
    <div className={"properties-table__numeric-filter"}>
        <input className={"field__control"} onChange={(event) => { onChange({ ...value, min: event.target.value }); }} placeholder={"Min"} value={value.min} />
        <input className={"field__control"} onChange={(event) => { onChange({ ...value, max: event.target.value }); }} placeholder={"Max"} value={value.max} />
    </div>
);

const reorderColumns = (state: PropertiesTableState, sourceColumnId: string, targetColumnId: string): PropertiesTableState => {
    const orderedColumnIds = [...state.orderedColumnIds];
    const sourceIndex = orderedColumnIds.indexOf(sourceColumnId);
    const targetIndex = orderedColumnIds.indexOf(targetColumnId);
    if (sourceIndex === -1 || targetIndex === -1) {
        return state;
    }

    orderedColumnIds.splice(sourceIndex, 1);
    orderedColumnIds.splice(targetIndex, 0, sourceColumnId);
    return { ...state, orderedColumnIds };
};

const readSummaryText = (summary: PropertySummary | undefined, keys: readonly string[]): string | undefined => {
    for (const key of keys) {
        const value = summary?.current_values[key]?.trim();
        if (value !== undefined && value !== "") {
            return value;
        }
    }

    return undefined;
};

const readSummaryNumber = (summary: PropertySummary | undefined, keys: readonly string[]): number | undefined => {
    const value = readSummaryText(summary, keys);
    if (value === undefined) {
        return undefined;
    }

    const parsed = Number(value.replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
    return Number.isFinite(parsed) ? parsed : undefined;
};

const matchesTextFilter = (value: string, filter: string): boolean => {
    return filter.trim() === "" || value.toLowerCase().includes(filter.trim().toLowerCase());
};

const matchesNumericRange = (value: number | undefined, filter: NumericRangeFilter): boolean => {
    if (filter.min.trim() === "" && filter.max.trim() === "") {
        return true;
    }
    if (value === undefined) {
        return false;
    }

    const min = filter.min.trim() === "" ? undefined : Number(filter.min);
    const max = filter.max.trim() === "" ? undefined : Number(filter.max);
    if (min !== undefined && Number.isFinite(min) && value < min) {
        return false;
    }
    if (max !== undefined && Number.isFinite(max) && value > max) {
        return false;
    }

    return true;
};

const matchesExactNumber = (value: number | undefined, filter: string): boolean => {
    return filter === "" || (value !== undefined && `${formatNumber(value)}` === filter);
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

const matchesSelectFilter = (value: string, filter: string): boolean => {
    return filter === "" || value === filter;
};

const buildDiscreteOptions = (values: readonly (number | undefined)[]): string[] => {
    return Array.from(new Set(values.filter((value): value is number => value !== undefined).map((value) => formatNumber(value)))).sort((left, right) => Number(left) - Number(right));
};

const decimalNumberFormatter = new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
});

const integerNumberFormatter = new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
});

const formatMoney = (value: number): string => formatCurrency(value, "EUR");

const formatNumber = (value: number): string => value % 1 === 0
    ? integerNumberFormatter.format(value)
    : decimalNumberFormatter.format(value);

const opportunityTone = (value: PropertyRow["opportunity"]): "danger" | "neutral" | "success" | "warning" => {
    switch (value) {
        case "cheap":
            return "success";
        case "expensive":
            return "warning";
        case "fair":
        case "unranked":
        default:
            return "neutral";
    }
};

const statusTone = (status: PropertyStatus): "danger" | "neutral" | "success" | "warning" => {
    switch (status) {
        case "active":
            return "success";
        case "degraded":
            return "warning";
        case "inactive":
            return "danger";
        case "pending":
        default:
            return "neutral";
    }
};
