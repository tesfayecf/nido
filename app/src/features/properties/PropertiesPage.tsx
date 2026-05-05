/**
 * File: app/src/features/properties/PropertiesPage.tsx
 *
 * Purpose:
 * Implements the properties feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, react, @tanstack/react-query, @tanstack/react-virtual, react-router-dom, @/components/ui/Button, @/components/ui/ConfirmDialog, @/components/ui/Dialog; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - react
 * - @tanstack/react-query
 * - @tanstack/react-virtual
 * - react-router-dom
 * - @/components/ui/Button
 * - @/components/ui/ConfirmDialog
 * - @/components/ui/Dialog
 * - @/components/ui/ErrorBanner
 * - @/components/ui/Field
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { ActionGroup } from "@/components/ui/ActionGroup";
import { readWorkspaceSettings } from "@/features/settings/workspaceSettings";
import { downloadPropertyListExport } from "@/features/properties/propertyExport";
import { formatDateTime } from "@/lib/format/date";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { alertRuleKeys } from "@/services/alert-rules/alert-rules.keys";
import { listAlertRules, setAlertRuleEnabled } from "@/services/alert-rules/alert-rules.service";
import { stringifyComparisonIds } from "@/features/properties/propertyCompare";
import { propertyKeys } from "@/services/properties/properties.keys";
import { deleteProperty, getProperty, ingestProperty, listProperties, listPropertySummaries, updateProperty } from "@/services/properties/properties.service";
import type { Property, PropertyStatus, PropertySummary } from "@/services/properties/properties.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags, listTags, setPropertyTags } from "@/services/tags/tags.service";
import { buildPriceIntelligence } from "@/features/properties/priceIntelligence";
import { formatCurrency } from "@/lib/format/currency";
import { scrollToTop } from "@/lib/ui/scroll";
import { readSessionStorageNumber } from "@/lib/ui/sessionStorage";
import {
    readPropertiesTableState,
    writePropertiesTableState,
    type NumericRangeFilter,
    type PropertiesTableFilters,
    type PropertiesTableState,
} from "@/features/properties/propertyTableState";

const TABLE_STORAGE_KEY = "nido.properties.table";
const TABLE_PAGE_STORAGE_KEY = "nido.properties.table.pagination";
const MIN_COLUMN_WIDTH = 96;
const PROPERTY_ROW_HEIGHT = 56;
const PROPERTY_PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

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

/**
 * Purpose: Renders the PropertiesPage UI boundary documented for app/src/features/properties/PropertiesPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
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
    const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
    const [tableState, setTableState] = useState<PropertiesTableState>(() => readPropertiesTableState(TABLE_STORAGE_KEY, COLUMN_IDS));
    const [exportOpen, setExportOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
    const [tagDialogOpen, setTagDialogOpen] = useState(false);
    const [tagAction, setTagAction] = useState<"add" | "remove">("add");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [alertAction, setAlertAction] = useState<"disable" | "enable" | null>(null);
    const columnMenuRef = useRef<HTMLDivElement | null>(null);
    const tableShellRef = useRef<HTMLDivElement | null>(null);
    const resizeStateRef = useRef<{ readonly columnId: string; readonly startWidth: number; readonly startX: number; } | null>(null);
    const [page, setPage] = useState(() => readSessionStorageNumber(`${TABLE_PAGE_STORAGE_KEY}:page`, 0, { allowZero: true }));
    const [pageSize, setPageSize] = useState(() => readSessionStorageNumber(`${TABLE_PAGE_STORAGE_KEY}:page-size`, 50));

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
    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.all(),
    });
    const alertRulesQuery = useQuery({
        queryFn: listAlertRules,
        queryKey: alertRuleKeys.all(),
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

    useEffect(() => {
        if (!columnMenuOpen) {
            return undefined;
        }

        const handleMouseDown = (event: MouseEvent): void => {
            if (!(event.target instanceof Node) || columnMenuRef.current?.contains(event.target)) {
                return;
            }

            setColumnMenuOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                setColumnMenuOpen(false);
            }
        };

        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [columnMenuOpen]);

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
    const bulkMutation = useMutation({
        mutationFn: async (action: "archive" | "delete" | "disable-alerts" | "enable-alerts" | "set-tags") => {
            const selectedRows = rows.filter((row) => selectedPropertyIds.includes(row.id));
            if (action === "set-tags") {
                await Promise.all(selectedRows.map(async (row) => {
                    const existingTagIds = (propertyTagQueries[rows.findIndex((candidate) => candidate.id === row.id)]?.data ?? []).map((tag) => tag.id);
                    const nextTagIds = tagAction === "add"
                        ? Array.from(new Set([...existingTagIds, ...selectedTagIds]))
                        : existingTagIds.filter((tagId) => !selectedTagIds.includes(tagId));
                    await setPropertyTags(row.id, nextTagIds);
                }));
                return;
            }

            if (action === "archive") {
                await Promise.all(selectedRows.map(async (row) => {
                    await updateProperty(row.id, {
                        label: row.property.label,
                        metadata: row.property.metadata,
                        pause_reason: row.property.pause_reason,
                        paused: row.property.paused,
                        retry_backoff_millis: row.property.retry_backoff_millis,
                        retry_max_attempts: row.property.retry_max_attempts,
                        schedule_interval_seconds: row.property.schedule_interval_seconds,
                        source_id: row.property.source_id,
                        status: "inactive",
                        url: row.property.url,
                    });
                }));
                return;
            }

            if (action === "delete") {
                await Promise.all(selectedRows.map(async (row) => deleteProperty(row.id)));
                return;
            }

            const rules = (alertRulesQuery.data ?? []).filter((rule) => selectedPropertyIds.includes(rule.property_id));
            await Promise.all(rules.map(async (rule) => setAlertRuleEnabled(rule.id, action === "enable-alerts")));
        },
        onError() {
            pushToast("Could not apply the selected bulk action.", "error");
        },
        onSuccess(_data, action) {
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: propertyKeys.all() }),
                queryClient.invalidateQueries({ queryKey: propertyKeys.summaries() }),
                queryClient.invalidateQueries({ queryKey: tagKeys.all() }),
                queryClient.invalidateQueries({ queryKey: alertRuleKeys.all() }),
            ]);
            setSelectedPropertyIds([]);
            setTagDialogOpen(false);
            setArchiveOpen(false);
            setDeleteOpen(false);
            setAlertAction(null);
            setSelectedTagIds([]);
            pushToast(
                action === "archive"
                    ? "Selected properties archived."
                    : action === "delete"
                        ? "Selected properties deleted."
                        : action === "set-tags"
                            ? "Selected tags updated."
                            : action === "enable-alerts"
                                ? "Alert rules enabled."
                                : "Alert rules disabled.",
                "success",
            );
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
    const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedPropertyIds.includes(row.id));
    const selectedCount = selectedPropertyIds.length;

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
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const pageStart = page * pageSize;
    const pagedRows = sortedRows.slice(pageStart, pageStart + pageSize);
    const rowVirtualizer = useVirtualizer({
        count: pagedRows.length,
        estimateSize: () => PROPERTY_ROW_HEIGHT,
        getScrollElement: () => tableShellRef.current,
        initialRect: { height: Math.min(pagedRows.length, pageSize) * PROPERTY_ROW_HEIGHT, width: 0 },
        overscan: 10,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const visiblePagedRows = virtualRows.length > 0
        ? virtualRows.flatMap((virtualRow) => {
            const row = pagedRows[virtualRow.index];
            return row === undefined ? [] : [{ row, virtualStart: virtualRow.start }];
        })
        : pagedRows.slice(0, Math.min(pagedRows.length, 20)).map((row, index) => ({
            row,
            virtualStart: index * PROPERTY_ROW_HEIGHT,
        }));

    const visibleColumns = useMemo(() => {
        const hiddenIds = new Set(tableState.hiddenColumnIds);
        return tableState.orderedColumnIds
            .map((columnId) => COLUMNS.find((column) => column.id === columnId))
            .filter((column): column is PropertyColumn => column !== undefined && !hiddenIds.has(column.id));
    }, [tableState.hiddenColumnIds, tableState.orderedColumnIds]);
    const activeFilterCount = countActiveFilters(tableState.filters);

    const roomOptions = useMemo(() => buildDiscreteOptions(rows.map((row) => row.rooms)), [rows]);
    const bathroomOptions = useMemo(() => buildDiscreteOptions(rows.map((row) => row.bathrooms)), [rows]);
    const locationOptions = useMemo(() => {
        const locations = rows
            .map((row) => row.location)
            .filter((value): value is string => value !== undefined && value !== "");

        return Array.from(new Set(locations)).sort((left, right) => left.localeCompare(right));
    }, [rows]);

    useEffect(() => {
        setPage((current) => Math.min(current, Math.max(0, totalPages - 1)));
    }, [totalPages]);

    useEffect(() => {
        sessionStorage.setItem(`${TABLE_PAGE_STORAGE_KEY}:page`, `${page}`);
        sessionStorage.setItem(`${TABLE_PAGE_STORAGE_KEY}:page-size`, `${pageSize}`);
    }, [page, pageSize]);

    useEffect(() => {
        scrollToTop(tableShellRef.current);
    }, [page]);

    const prefetchPropertyDetail = (propertyId: string): void => {
        void queryClient.prefetchQuery({
            queryFn: () => getProperty(propertyId),
            queryKey: propertyKeys.detail(propertyId),
            staleTime: 30_000,
        });
    };

    return (
        <PageStack>
            <PageCard
                action={(
                    <div className={"action-group"}>
                        <div className={"properties-table__column-menu"} ref={columnMenuRef}>
                            <Button
                                aria-controls={"properties-columns-popover"}
                                aria-expanded={columnMenuOpen}
                                aria-haspopup={"true"}
                                onClick={() => { setColumnMenuOpen((open) => !open); }}
                                variant={"secondary"}
                            >
                                {"Columns"}
                            </Button>
                            {columnMenuOpen ? (
                                <div aria-label={"Visible columns"} className={"properties-table__column-menu-popover"} id={"properties-columns-popover"} role={"group"}>
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
                        <Button aria-expanded={filtersOpen} onClick={() => { setFiltersOpen((open) => !open); }} variant={"secondary"}>
                            {filtersOpen
                                ? activeFilterCount > 0 ? `Hide filters (${activeFilterCount} active)` : "Hide filters"
                                : activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
                        </Button>
                        {activeFilterCount > 0 ? (
                            <Button
                                onClick={() => {
                                    setTableState((current) => ({
                                        ...current,
                                        filters: {
                                            bathrooms: "",
                                            location: "",
                                            opportunity: "",
                                            price: { max: "", min: "" },
                                            pricePerSquareMeter: { max: "", min: "" },
                                            property: "",
                                            propertyAge: { max: "", min: "" },
                                            rooms: "",
                                            sizeSquareMeters: { max: "", min: "" },
                                            status: "",
                                        },
                                    }));
                                }}
                                variant={"secondary"}
                            >
                                {"Clear filters"}
                            </Button>
                        ) : null}
                        <Button onClick={() => { setExportOpen(true); }} variant={"secondary"}>
                            {"Export"}
                        </Button>
                        <Button
                            onClick={() => {
                                const ids = sortedRows.map((row) => row.id);
                                window.open(`/properties/print?ids=${encodeURIComponent(stringifyComparisonIds(ids))}`, "_blank", "noopener");
                            }}
                            variant={"secondary"}
                        >
                            {"Print / PDF"}
                        </Button>
                        <Button as={Link} iconBefore={<Icon name={"plus"} />} to={"/properties/new"}>
                            {"Add Property"}
                        </Button>
                    </div>
                )}
                description={"Price-first table view with filters tucked away until needed."}
                title={"Properties"}
            >
                <section aria-label={"Portfolio snapshot"} className={"properties-page__summary"}>
                    <div className={"properties-page__summary-item"}>
                        <span className={"properties-page__summary-label"}>{"Tracked properties"}</span>
                        <strong className={"properties-page__summary-value"}>{rows.length}</strong>
                        <span className={"properties-page__summary-meta"}>{rows.length === 0 ? "No tracked properties yet." : "Across the current workspace."}</span>
                    </div>
                    <div className={"properties-page__summary-item"}>
                        <span className={"properties-page__summary-label"}>{"In current view"}</span>
                        <strong className={"properties-page__summary-value"}>{sortedRows.length}</strong>
                        <span className={"properties-page__summary-meta"}>{sortedRows.length === rows.length ? "No rows hidden by filters." : `${rows.length - sortedRows.length} hidden by filters.`}</span>
                    </div>
                    <div className={"properties-page__summary-item"}>
                        <span className={"properties-page__summary-label"}>{"Selected"}</span>
                        <strong className={"properties-page__summary-value"}>{selectedCount}</strong>
                        <span className={"properties-page__summary-meta"}>{selectedCount === 0 ? "Select rows to unlock bulk actions." : "Bulk actions are ready."}</span>
                    </div>
                    <div className={"properties-page__summary-item"}>
                        <span className={"properties-page__summary-label"}>{"Active filters"}</span>
                        <strong className={"properties-page__summary-value"}>{activeFilterCount}</strong>
                        <span className={"properties-page__summary-meta"}>{filtersOpen ? "Filter controls are visible." : "Open filters to narrow the table."}</span>
                    </div>
                </section>
                {selectedCount > 0 ? (
                    <div className={"toolbar"}>
                        <strong>{`${selectedCount} selected`}</strong>
                        <ActionGroup>
                            <Button
                                disabled={selectedCount < 2 || selectedCount > 4}
                                onClick={() => {
                                    void navigate(`/properties/compare?ids=${encodeURIComponent(stringifyComparisonIds(selectedPropertyIds))}`);
                                }}
                                variant={"secondary"}
                            >
                                {"Compare"}
                            </Button>
                            <Button onClick={() => { setTagAction("add"); setTagDialogOpen(true); }} variant={"secondary"}>{"Add tags"}</Button>
                            <Button onClick={() => { setTagAction("remove"); setTagDialogOpen(true); }} variant={"secondary"}>{"Remove tags"}</Button>
                            <Button onClick={() => { setAlertAction("enable"); }} variant={"secondary"}>{"Enable alerts"}</Button>
                            <Button onClick={() => { setAlertAction("disable"); }} variant={"secondary"}>{"Disable alerts"}</Button>
                            <Button onClick={() => { setArchiveOpen(true); }} variant={"secondary"}>{"Archive"}</Button>
                            <Button onClick={() => { setDeleteOpen(true); }} variant={"destructive"}>{"Delete"}</Button>
                        </ActionGroup>
                    </div>
                ) : null}
                {propertiesQuery.isError || summariesQuery.isError ? <ErrorBanner>{"Could not load the portfolio table."}</ErrorBanner> : null}
                {(propertiesQuery.isLoading || summariesQuery.isLoading) ? <p className={"state-message state-message--loading"}>{"Loading properties..."}</p> : null}
                {!propertiesQuery.isLoading && !summariesQuery.isLoading ? 
                    sortedRows.length === 0 && rows.length === 0 ? 
                        <p className={"muted-copy"}>{"No properties are being tracked yet."}</p>
                        : sortedRows.length === 0 ? (
                            <p className={"muted-copy"}>{"No properties match the current filters. Clear filters or adjust the table controls."}</p>
                        )
                        : (
                            <>
                                <div className={"properties-table__shell"} ref={tableShellRef}>
                                    <table className={"properties-table"} id={"properties-table"}>
                                        <thead>
                                            <tr>
                                                <th scope={"col"} style={{ width: 52 }}>
                                                    <input
                                                        aria-label={"Select all filtered properties"}
                                                        checked={allFilteredSelected}
                                                        onChange={(event) => {
                                                            setSelectedPropertyIds(event.target.checked ? filteredRows.map((row) => row.id) : []);
                                                        }}
                                                        type={"checkbox"}
                                                    />
                                                </th>
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
                                                    <th />
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
                                        <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                                            {visiblePagedRows.map(({ row, virtualStart }) => {
                                                const isBookmarked = bookmarkedIds.has(row.id);
                                                return (
                                                    <tr
                                                        aria-label={`Open property ${row.label.trim() !== "" ? row.label : row.url.trim() !== "" ? row.url : row.id}`}
                                                        className={"properties-table__row properties-table__row--interactive properties-table__row--virtual"}
                                                        data-index={row.id}
                                                        key={row.id}
                                                        onClick={(event) => {
                                                            if (!isEventFromInteractiveElement(event.target, event.currentTarget)) {
                                                                void navigate(`/properties/${row.id}`);
                                                            }
                                                        }}
                                                        onFocus={() => { prefetchPropertyDetail(row.id); }}
                                                        onKeyDown={(event) => {
                                                            if (isEventFromInteractiveElement(event.target, event.currentTarget)) {
                                                                return;
                                                            }

                                                            if (event.key === "Enter" || event.key === " ") {
                                                                event.preventDefault();
                                                                void navigate(`/properties/${row.id}`);
                                                            }
                                                        }}
                                                        onMouseEnter={() => { prefetchPropertyDetail(row.id); }}
                                                        role={"button"}
                                                        style={{ transform: `translateY(${virtualStart}px)` }}
                                                        tabIndex={0}
                                                    >
                                                        <td>
                                                            <input
                                                                aria-label={`Select ${row.label}`}
                                                                checked={selectedPropertyIds.includes(row.id)}
                                                                onChange={(event) => {
                                                                    setSelectedPropertyIds((current) => event.target.checked
                                                                        ? [...current, row.id]
                                                                        : current.filter((propertyId) => propertyId !== row.id));
                                                                }}
                                                                type={"checkbox"}
                                                            />
                                                        </td>
                                                        {visibleColumns.map((column) => (
                                                            <td key={`${row.id}-${column.id}`}>
                                                                <div className={"properties-table__cell"}>
                                                                    {renderColumnCell(column.id, row, column.render(row))}
                                                                </div>
                                                            </td>
                                                        ))}
                                                        <td>
                                                            <RowActions>
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
                                {totalPages > 1 ? (
                                    <div className={"data-table__pagination"}>
                                        <span>{`Page ${page + 1} of ${totalPages} · ${sortedRows.length} properties`}</span>
                                        <div className={"action-group"}>
                                            <label className={"data-table__page-size"}>
                                                <span>{"Rows"}</span>
                                                <select
                                                    onChange={(event) => {
                                                        setPageSize(Number(event.target.value));
                                                        setPage(0);
                                                    }}
                                                    value={pageSize}
                                                >
                                                    {PROPERTY_PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                                </select>
                                            </label>
                                            <Button disabled={page === 0} onClick={() => { setPage((current) => Math.max(0, current - 1)); }} size={"small"} variant={"secondary"}>{"Previous"}</Button>
                                            <Button disabled={page >= totalPages - 1} onClick={() => { setPage((current) => Math.min(totalPages - 1, current + 1)); }} size={"small"} variant={"secondary"}>{"Next"}</Button>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        )
                    : null}
            </PageCard>
            <Dialog
                actions={(
                    <ActionGroup>
                        <Button onClick={() => { setExportOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button
                            onClick={() => {
                                downloadPropertyListExport(
                                    sortedRows.map((row) => Object.fromEntries([
                                        ["id", row.id],
                                        ...visibleColumns.map((column) => [column.id, typeof column.render(row) === "string" ? column.render(row) : column.sortValue(row)]),
                                        ["url", row.url],
                                    ])),
                                    visibleColumns.map((column) => ({ header: column.header, id: column.id })),
                                    exportFormat,
                                );
                                setExportOpen(false);
                            }}
                        >
                            {`Download ${exportFormat.toUpperCase()}`}
                        </Button>
                    </ActionGroup>
                )}
                description={"Exports respect the current filters and visible columns."}
                onOpenChange={setExportOpen}
                open={exportOpen}
                title={"Export properties"}
            >
                <div className={"dashboard-grid"}>
                    <label className={"properties-table__column-toggle"}>
                        <input checked={exportFormat === "csv"} onChange={() => { setExportFormat("csv"); }} type={"radio"} />
                        <span>{"CSV"}</span>
                    </label>
                    <label className={"properties-table__column-toggle"}>
                        <input checked={exportFormat === "json"} onChange={() => { setExportFormat("json"); }} type={"radio"} />
                        <span>{"JSON"}</span>
                    </label>
                </div>
            </Dialog>
            <Dialog
                actions={(
                    <ActionGroup>
                        <Button onClick={() => { setTagDialogOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button
                            disabled={selectedTagIds.length === 0}
                            isLoading={bulkMutation.isPending}
                            onClick={() => { bulkMutation.mutate("set-tags"); }}
                        >
                            {tagAction === "add" ? "Apply tags" : "Remove tags"}
                        </Button>
                    </ActionGroup>
                )}
                description={`Apply this tag update to ${selectedCount} selected properties.`}
                onOpenChange={setTagDialogOpen}
                open={tagDialogOpen}
                title={tagAction === "add" ? "Bulk add tags" : "Bulk remove tags"}
            >
                <Field label={"Tags"}>
                    <MultiSelect
                        onChange={setSelectedTagIds}
                        options={(tagsQuery.data ?? []).map((tag) => ({ label: tag.name, value: tag.id }))}
                        values={selectedTagIds}
                    />
                </Field>
            </Dialog>
            <ConfirmDialog
                confirmLabel={"Archive selected"}
                description={`Archive ${selectedCount} selected properties?`}
                isPending={bulkMutation.isPending}
                onConfirm={() => { bulkMutation.mutate("archive"); }}
                onOpenChange={setArchiveOpen}
                open={archiveOpen}
                title={"Archive properties"}
            />
            <ConfirmDialog
                confirmLabel={"Delete selected"}
                description={`Delete ${selectedCount} selected properties? This cannot be undone.`}
                isPending={bulkMutation.isPending}
                onConfirm={() => { bulkMutation.mutate("delete"); }}
                onOpenChange={setDeleteOpen}
                open={deleteOpen}
                title={"Delete properties"}
            />
            <ConfirmDialog
                confirmLabel={alertAction === "enable" ? "Enable alerts" : "Disable alerts"}
                description={`${alertAction === "enable" ? "Enable" : "Disable"} alert rules for the selected properties.`}
                isPending={bulkMutation.isPending}
                onConfirm={() => {
                    if (alertAction !== null) {
                        bulkMutation.mutate(alertAction === "enable" ? "enable-alerts" : "disable-alerts");
                    }
                }}
                onOpenChange={(open) => { if (!open) { setAlertAction(null); } }}
                open={alertAction !== null}
                title={alertAction === "enable" ? "Enable alerts" : "Disable alerts"}
            />
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

const countActiveFilters = (filters: PropertiesTableFilters): number => {
    let count = 0;

    if (filters.property.trim() !== "") {
        count += 1;
    }
    if (filters.location.trim() !== "") {
        count += 1;
    }
    if (filters.rooms.trim() !== "") {
        count += 1;
    }
    if (filters.bathrooms.trim() !== "") {
        count += 1;
    }
    if (filters.status.trim() !== "") {
        count += 1;
    }
    if (filters.opportunity.trim() !== "") {
        count += 1;
    }
    if (filters.price.min.trim() !== "" || filters.price.max.trim() !== "") {
        count += 1;
    }
    if (filters.sizeSquareMeters.min.trim() !== "" || filters.sizeSquareMeters.max.trim() !== "") {
        count += 1;
    }
    if (filters.pricePerSquareMeter.min.trim() !== "" || filters.pricePerSquareMeter.max.trim() !== "") {
        count += 1;
    }
    if (filters.propertyAge.min.trim() !== "" || filters.propertyAge.max.trim() !== "") {
        count += 1;
    }

    return count;
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

/**
 * Returns true when the event started from an interactive child, excluding the
 * row element itself so row clicks still navigate.
 */
const isEventFromInteractiveElement = (target: EventTarget | null, currentTarget?: HTMLElement): boolean => {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    const interactiveElement = target.closest(INTERACTIVE_SELECTOR);
    return interactiveElement !== null && interactiveElement !== currentTarget;
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
