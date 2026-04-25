import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { PageCard } from "@/components/ui/PageCard";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { TagBadge } from "@/components/tags/TagBadge";
import { TagFilter } from "@/components/tags/TagFilter";
import { parseNumeric } from "@/features/analytics/analytics.utils";
import { SAVED_VIEW_OPTIONS, applySavedView, buildPropertyRunSummary, mergeBulkTagIds, retainVisibleSelection, type SavedViewId } from "@/features/operators/operatorWorkflows";
import { formatDateTime } from "@/lib/format/date";
import { writeParam } from "@/lib/routing/searchParams";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { listRuns } from "@/services/backoffice-runs/runs.service";
import type { Run } from "@/services/backoffice-runs/runs.types";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { deleteProperty, ingestProperty, listProperties, updateProperty } from "@/services/properties/properties.service";
import type { Property, PropertyStatus } from "@/services/properties/properties.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags, listTags, setPropertyTags } from "@/services/tags/tags.service";
import type { Tag } from "@/services/tags/tags.types";

const DEFAULT_TAG_MATCH = "any" as const;
const RUN_FILTERS = { limit: 150, property_id: "" };
const STATUS_FILTER_OPTIONS: readonly { readonly label: string; readonly value: PropertyStatus | "all"; }[] = [
    { label: "All statuses", value: "all" },
    { label: "Active", value: "active" },
    { label: "Degraded", value: "degraded" },
    { label: "Inactive", value: "inactive" },
    { label: "Pending", value: "pending" },
];

interface SignalBadge {
    readonly label: string;
    readonly tone: "danger" | "neutral" | "success" | "warning";
}

interface PropertyTableRow {
    readonly bedrooms?: number;
    readonly facts: readonly string[];
    readonly id: string;
    readonly isBookmarked: boolean;
    readonly label: string;
    readonly lastSeen?: string;
    readonly location?: string;
    readonly price?: number;
    readonly pricePerSquareMeter?: number;
    readonly property: Property;
    readonly signals: readonly SignalBadge[];
    readonly sizeSquareMeters?: number;
    readonly tags: readonly Tag[];
    readonly trackingLabel: string;
    readonly url: string;
}

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

export const PropertiesPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
    const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
    const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
    const [bulkAction, setBulkAction] = useState<"pause" | "run" | null>(null);
    const [statusFilter, setStatusFilter] = useState<PropertyStatus | "all">("all");
    const [locationFilter, setLocationFilter] = useState("");
    const [searchValue, setSearchValue] = useState("");

    const tagIdsFromUrl = searchParams.getAll("tag");
    const tagMatchFromUrl = (searchParams.get("match") ?? DEFAULT_TAG_MATCH) as "any" | "all";
    const rawSavedViewId = (searchParams.get("view") ?? "all") as SavedViewId;
    const savedViewId = SAVED_VIEW_OPTIONS.some((option) => option.id === rawSavedViewId) ? rawSavedViewId : "all";

    const propertiesQuery = useQuery({
        queryFn: () => listProperties({
            tagIds: tagIdsFromUrl.length > 0 ? tagIdsFromUrl : undefined,
            tagMatch: tagIdsFromUrl.length > 0 ? tagMatchFromUrl : undefined,
        }),
        queryKey: [...propertyKeys.list(), { tagIds: tagIdsFromUrl, tagMatch: tagMatchFromUrl }],
    });
    const runsQuery = useQuery({
        queryFn: () => listRuns(RUN_FILTERS),
        queryKey: runKeys.list(RUN_FILTERS),
    });
    const allTagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.list(),
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

    const deleteMutation = useMutation({
        mutationFn: deleteProperty,
        onError() {
            pushToast("Could not delete property.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
            setDeleteTarget(null);
            pushToast("Property deleted.", "success");
        },
    });
    const ingestMutation = useMutation({
        mutationFn: ({ propertyId }: { propertyId: string; }) => ingestProperty(propertyId),
        onError() {
            pushToast("Could not trigger the run.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            pushToast("Run started.", "success");
        },
    });
    const bookmarkMutation = useMutation({
        mutationFn: async ({ isBookmarked, propertyId }: { isBookmarked: boolean; propertyId: string; }) => {
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
    const bulkTagMutation = useMutation({
        mutationFn: async () => {
            const propertyTagIds = new Map<string, string[]>();
            (propertiesQuery.data ?? []).forEach((property, index) => {
                propertyTagIds.set(property.id, (propertyTagQueries[index]?.data ?? []).map((tag) => tag.id));
            });

            for (const propertyId of selectedPropertyIds) {
                const currentTagIds = propertyTagIds.get(propertyId) ?? [];
                const nextTagIds = mergeBulkTagIds(currentTagIds, bulkTagIds);
                await setPropertyTags(propertyId, nextTagIds);
            }
        },
        onError() {
            pushToast("Could not update tags for the selected properties.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: tagKeys.all() });
            setBulkTagIds([]);
            setSelectedPropertyIds([]);
            pushToast("Tags applied to the selected properties.", "success");
        },
    });
    const bulkPauseMutation = useMutation({
        mutationFn: async () => {
            for (const propertyId of selectedPropertyIds) {
                const property = (propertiesQuery.data ?? []).find((candidate) => candidate.id === propertyId);
                if (property === undefined) {
                    continue;
                }

                await updateProperty(property.id, {
                    label: property.label,
                    retry_backoff_millis: property.retry_backoff_millis,
                    retry_max_attempts: property.retry_max_attempts,
                    schedule_interval_seconds: 0,
                    source_id: property.source_id,
                    url: property.url,
                });
            }
        },
        onError() {
            pushToast("Could not pause schedules for the selected properties.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            setSelectedPropertyIds([]);
            setBulkAction(null);
            pushToast("Paused schedules for the selected properties.", "success");
        },
    });
    const bulkRunMutation = useMutation({
        mutationFn: async () => {
            for (const propertyId of selectedPropertyIds) {
                await ingestProperty(propertyId);
            }
        },
        onError() {
            pushToast("Could not run all selected properties.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            setSelectedPropertyIds([]);
            setBulkAction(null);
            pushToast("Started runs for the selected properties.", "success");
        },
    });

    const propertyTagsMap = useMemo(() => {
        const map = new Map<string, string[]>();
        (propertiesQuery.data ?? []).forEach((property, index) => {
            const tags = propertyTagQueries[index]?.data ?? [];
            map.set(property.id, tags.map((tag) => tag.id));
        });
        return map;
    }, [propertiesQuery.data, propertyTagQueries]);
    const allTags = useMemo(() => allTagsQuery.data ?? [], [allTagsQuery.data]);
    const allTagsById = useMemo(() => new Map(allTags.map((tag) => [tag.id, tag])), [allTags]);
    const bookmarkedIds = useMemo(() => new Set((bookmarksQuery.data ?? []).map((item) => item.property_id)), [bookmarksQuery.data]);
    const propertyRunSummary = useMemo(() => buildPropertyRunSummary(runsQuery.data?.items ?? []), [runsQuery.data?.items]);
    const propertyTagNamesById = useMemo(() => {
        const namesById = new Map<string, readonly string[]>();
        (propertiesQuery.data ?? []).forEach((property) => {
            const tagIds = propertyTagsMap.get(property.id) ?? [];
            namesById.set(property.id, tagIds.map((tagId) => allTagsById.get(tagId)?.name).filter((value): value is string => value !== undefined));
        });
        return namesById;
    }, [allTagsById, propertiesQuery.data, propertyTagsMap]);
    const savedView = SAVED_VIEW_OPTIONS.find((option) => option.id === savedViewId)
        ?? SAVED_VIEW_OPTIONS[0]
        ?? { description: "", id: "all" as const, label: "All properties" };

    const baseProperties = useMemo(() => {
        const scoped = applySavedView(propertiesQuery.data ?? [], {
            bookmarkedIds,
            propertyTagNamesById,
            runSummaryByPropertyId: propertyRunSummary,
            viewId: savedViewId,
        });

        return scoped.filter((item) => !bookmarkedOnly || bookmarkedIds.has(item.id));
    }, [bookmarkedIds, bookmarkedOnly, propertiesQuery.data, propertyRunSummary, propertyTagNamesById, savedViewId]);

    const propertyRows = useMemo(() => {
        return baseProperties.map((property) => {
            const latestRun = propertyRunSummary.get(property.id)?.latestRun;
            const tagIds = propertyTagsMap.get(property.id) ?? [];
            const tags = tagIds.map((tagId) => allTagsById.get(tagId)).filter((tag): tag is Tag => tag !== undefined);
            return buildPropertyTableRow(property, latestRun, tags, bookmarkedIds.has(property.id));
        });
    }, [allTagsById, baseProperties, bookmarkedIds, propertyRunSummary, propertyTagsMap]);

    const locationOptions = useMemo(() => {
        return Array.from(new Set(propertyRows.map((row) => row.location).filter((value): value is string => value !== undefined && value.trim() !== ""))).sort((left, right) => left.localeCompare(right));
    }, [propertyRows]);

    const filteredRows = useMemo(() => {
        const normalizedSearch = searchValue.trim().toLowerCase();
        return propertyRows.filter((row) => {
            const matchesStatus = statusFilter === "all" || row.property.status === statusFilter;
            const matchesLocation = locationFilter === "" || row.location === locationFilter;
            const matchesSearch = normalizedSearch === ""
                || [
                    row.label,
                    row.url,
                    row.location,
                    row.facts.join(" "),
                    row.signals.map((signal) => signal.label).join(" "),
                    row.tags.map((tag) => tag.name).join(" "),
                ].some((value) => value?.toLowerCase().includes(normalizedSearch) === true);
            return matchesStatus && matchesLocation && matchesSearch;
        });
    }, [locationFilter, propertyRows, searchValue, statusFilter]);

    useEffect(() => {
        setSelectedPropertyIds((current) => retainVisibleSelection(current, filteredRows.map((row) => row.id)));
    }, [filteredRows]);

    const selectedRows = filteredRows.filter((row) => selectedPropertyIds.includes(row.id));
    const selectedProperties = selectedRows.map((row) => row.property);
    const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedPropertyIds.includes(row.id));
    const summaryCards = useMemo(() => {
        const belowTarget = propertyRows.filter((row) => row.price !== undefined && row.property.metadata?.target_price !== undefined && row.price <= row.property.metadata.target_price).length;
        const reviewQueue = propertyRows.filter((row) => row.property.status !== "active").length;
        const freshSignals = propertyRows.filter((row) => row.signals.some((signal) => signal.label === "Price updated")).length;
        const shortlist = propertyRows.filter((row) => row.isBookmarked).length;
        return [
            { label: "In scope", value: `${filteredRows.length}` },
            { label: "Below target", value: `${belowTarget}` },
            { label: "Saved", value: `${shortlist}` },
            { label: "Needs review", value: `${reviewQueue + freshSignals}` },
        ];
    }, [filteredRows.length, propertyRows]);

    const handleTagFilterChange = (tagIds: string[], tagMatch: "any" | "all"): void => {
        const params = new URLSearchParams(searchParams);
        params.delete("tag");
        tagIds.forEach((id) => {
            params.append("tag", id);
        });
        writeParam(params, "match", tagIds.length > 0 && tagMatch !== DEFAULT_TAG_MATCH ? tagMatch : undefined);
        setSearchParams(params);
    };

    const setSavedView = (viewId: SavedViewId): void => {
        const params = new URLSearchParams(searchParams);
        writeParam(params, "view", viewId === "all" ? undefined : viewId);
        setSearchParams(params);
    };

    return (
        <>
            <PageCard
                action={(
                    <Button iconBefore={<Icon name={"plus"} />} onClick={() => { void navigate("/properties/new"); }}>
                        {"New property"}
                    </Button>
                )}
                description={"Scan pricing, location, and opportunity signals first. Admin details stay out of the way until you choose to drill in."}
                title={"Properties"}
            >
                <div className={"enterprise-section-stack"}>
                    <div aria-label={"Saved property views"} className={"enterprise-chip-row enterprise-chip-row--saved-views"} role={"group"}>
                        {SAVED_VIEW_OPTIONS.map((option) => {
                            const isActive = savedViewId === option.id;

                            return (
                                <Button
                                    aria-pressed={isActive}
                                    className={isActive ? "enterprise-chip-button enterprise-chip-button--active" : "enterprise-chip-button"}
                                    key={option.id}
                                    onClick={() => { setSavedView(option.id); }}
                                    size={"small"}
                                    variant={isActive ? "primary" : "secondary"}
                                >
                                    {option.label}
                                </Button>
                            );
                        })}
                    </div>
                    <span className={"muted-copy"}>{savedView.description}</span>
                    <div className={"enterprise-metric-grid"}>
                        {summaryCards.map((card) => (
                            <div className={"enterprise-metric-card"} key={card.label}>
                                <span className={"enterprise-metric-card__label"}>{card.label}</span>
                                <strong className={"enterprise-metric-card__value"}>{card.value}</strong>
                            </div>
                        ))}
                    </div>
                    <div className={"enterprise-filter-grid"}>
                        <Field label={"Search"}>
                            <Input onChange={(event) => { setSearchValue(event.target.value); }} placeholder={"Search property, location, tag, or signal"} value={searchValue} />
                        </Field>
                        <Field label={"Status"}>
                            <select className={"field__control"} onChange={(event) => { setStatusFilter(event.target.value as PropertyStatus | "all"); }} value={statusFilter}>
                                {STATUS_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </Field>
                        <Field label={"Location"}>
                            <select className={"field__control"} onChange={(event) => { setLocationFilter(event.target.value); }} value={locationFilter}>
                                <option value={""}>{"All locations"}</option>
                                {locationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </Field>
                        <Field hint={"Focus only on saved opportunities."} label={"Saved only"} variant={"checkbox"}>
                            <input
                                checked={bookmarkedOnly}
                                onChange={(event) => {
                                    setBookmarkedOnly(event.target.checked);
                                }}
                                type={"checkbox"}
                            />
                        </Field>
                    </div>
                    <TagFilter
                        onChange={handleTagFilterChange}
                        selectedTagIds={tagIdsFromUrl}
                        tagMatch={tagMatchFromUrl}
                    />
                </div>
            </PageCard>

            {selectedPropertyIds.length > 0 ? (
                <PageCard description={"Apply safe bulk actions to the current selection."} title={`Bulk actions (${selectedPropertyIds.length})`}>
                    <div className={"enterprise-section-stack"}>
                        <Field label={"Add tags"}>
                            <MultiSelect
                                onChange={setBulkTagIds}
                                options={allTags.map((tag) => ({
                                    label: tag.name,
                                    value: tag.id,
                                }))}
                                placeholder={"Choose tags to add"}
                                values={bulkTagIds}
                            />
                        </Field>
                        <div className={"toolbar"}>
                            <Button disabled={bulkTagIds.length === 0 || bulkTagMutation.isPending} isLoading={bulkTagMutation.isPending} onClick={() => { bulkTagMutation.mutate(); }} variant={"secondary"}>
                                {"Add tags"}
                            </Button>
                            <Button disabled={bulkRunMutation.isPending} onClick={() => { setBulkAction("run"); }} variant={"secondary"}>{"Run now"}</Button>
                            <Button disabled={bulkPauseMutation.isPending} onClick={() => { setBulkAction("pause"); }} variant={"secondary"}>{"Pause schedules"}</Button>
                            <Button onClick={() => { setSelectedPropertyIds([]); }} variant={"secondary"}>{"Clear selection"}</Button>
                        </div>
                        <span className={"muted-copy"}>{selectedProperties.map((property) => property.label !== "" ? property.label : property.url).join(" · ")}</span>
                    </div>
                </PageCard>
            ) : null}

            {propertiesQuery.isLoading ? <p className={"state-message state-message--loading"}>{"Loading properties..."}</p> : null}
            {propertiesQuery.isError ? <ErrorBanner>{"Could not load properties."}</ErrorBanner> : null}
            {!propertiesQuery.isLoading && !propertiesQuery.isError ? (
                <DataTable
                    caption={"Tracked properties"}
                    columns={[
                        {
                            cell: (item) => (
                                <input
                                    aria-label={`Select ${item.label}`}
                                    checked={selectedPropertyIds.includes(item.id)}
                                    onChange={(event) => {
                                        setSelectedPropertyIds((current) => {
                                            if (event.target.checked) {
                                                return current.includes(item.id) ? current : [...current, item.id];
                                            }

                                            return current.filter((propertyId) => propertyId !== item.id);
                                        });
                                    }}
                                    type={"checkbox"}
                                />
                            ),
                            header: (
                                <input
                                    aria-label={allVisibleSelected ? "Clear selection" : "Select all visible properties"}
                                    checked={allVisibleSelected}
                                    onChange={(event) => {
                                        setSelectedPropertyIds(event.target.checked ? filteredRows.map((row) => row.id) : []);
                                    }}
                                    type={"checkbox"}
                                />
                            ),
                            id: "select",
                            width: "3rem",
                        },
                        {
                            cell: (item) => (
                                <div className={"data-table__primary"}>
                                    <strong>{item.label}</strong>
                                    <span className={"table-subcopy"}>{item.url}</span>
                                </div>
                            ),
                            header: "Property",
                            id: "property",
                            sortValue: (item) => item.label,
                            width: "16rem",
                        },
                        {
                            cell: (item) => item.location ?? "—",
                            header: "Location",
                            id: "location",
                            sortValue: (item) => item.location ?? "",
                            width: "11rem",
                        },
                        {
                            align: "right",
                            cell: (item) => item.price !== undefined ? formatMoney(item.price) : <span className={"muted-copy"}>{"—"}</span>,
                            header: "Price",
                            id: "price",
                            sortValue: (item) => item.price ?? -1,
                            width: "8rem",
                        },
                        {
                            align: "right",
                            cell: (item) => item.pricePerSquareMeter !== undefined ? `${formatCompactNumber(item.pricePerSquareMeter)} €/m²` : <span className={"muted-copy"}>{"—"}</span>,
                            header: "€/m²",
                            id: "price-per-square-meter",
                            sortValue: (item) => item.pricePerSquareMeter ?? -1,
                            width: "8rem",
                        },
                        {
                            cell: (item) => item.facts.length > 0 ? (
                                <div className={"enterprise-inline-list"}>
                                    {item.facts.map((fact) => <span className={"enterprise-inline-chip"} key={fact}>{fact}</span>)}
                                </div>
                            ) : <span className={"muted-copy"}>{"—"}</span>,
                            header: "Key attributes",
                            id: "facts",
                            sortValue: (item) => item.facts.join(" "),
                            width: "13rem",
                            wrap: true,
                        },
                        {
                            cell: (item) => item.tags.length > 0 ? (
                                <div className={"enterprise-inline-list"}>
                                    {item.tags.map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                                </div>
                            ) : <span className={"muted-copy"}>{"—"}</span>,
                            header: "Tags",
                            id: "tags",
                            sortValue: (item) => item.tags.map((tag) => tag.name).join(" "),
                            width: "12rem",
                            wrap: true,
                        },
                        {
                            cell: (item) => (
                                <div className={"enterprise-inline-list"}>
                                    {item.signals.map((signal) => <StatusBadge key={signal.label} tone={signal.tone} value={signal.label} />)}
                                </div>
                            ),
                            header: "Signals",
                            id: "signals",
                            sortValue: (item) => item.signals.map((signal) => signal.label).join(" "),
                            width: "14rem",
                            wrap: true,
                        },
                        {
                            cell: (item) => <StatusBadge tone={statusTone(item.property.status)} value={item.property.status} />,
                            header: "Status",
                            id: "status",
                            sortValue: (item) => item.property.status,
                            width: "8rem",
                        },
                        {
                            cell: (item) => (
                                <div className={"data-table__primary"}>
                                    <strong>{item.trackingLabel}</strong>
                                    <span className={"table-subcopy"}>{item.lastSeen !== undefined ? `Seen ${formatDateTime(item.lastSeen)}` : "No successful run yet"}</span>
                                </div>
                            ),
                            header: "Tracking",
                            id: "tracking",
                            sortValue: (item) => item.lastSeen ?? item.property.updated_at ?? "",
                            width: "12rem",
                        },
                        {
                            align: "right",
                            cell: (item) => {
                                const isBookmarked = item.isBookmarked;
                                return (
                                    <RowActions
                                        menuItems={[
                                            {
                                                label: isBookmarked ? "Remove bookmark" : "Save to shortlist",
                                                onSelect: () => {
                                                    bookmarkMutation.mutate({ isBookmarked, propertyId: item.id });
                                                },
                                            },
                                            {
                                                label: "View run history",
                                                onSelect: () => {
                                                    void navigate(`/runs?property_id=${encodeURIComponent(item.id)}`);
                                                },
                                            },
                                            {
                                                label: "Run now",
                                                onSelect: () => {
                                                    ingestMutation.mutate({ propertyId: item.id });
                                                },
                                            },
                                        ]}
                                    >
                                        <button
                                            aria-label={isBookmarked ? "Remove bookmark" : "Save to shortlist"}
                                            aria-pressed={isBookmarked}
                                            className={"icon-button"}
                                            onClick={() => {
                                                bookmarkMutation.mutate({ isBookmarked, propertyId: item.id });
                                            }}
                                            type={"button"}
                                        >
                                            <Icon name={isBookmarked ? "bookmark-filled" : "bookmark"} />
                                        </button>
                                        <button
                                            aria-label={"Run now"}
                                            className={"icon-button"}
                                            onClick={() => {
                                                ingestMutation.mutate({ propertyId: item.id });
                                            }}
                                            title={"Run now"}
                                            type={"button"}
                                        >
                                            <Icon name={"play"} />
                                        </button>
                                        <button
                                            aria-label={"Delete property"}
                                            className={"icon-button icon-button--danger"}
                                            onClick={() => { setDeleteTarget(item.property); }}
                                            title={"Delete"}
                                            type={"button"}
                                        >
                                            <Icon name={"trash"} />
                                        </button>
                                    </RowActions>
                                );
                            },
                            header: "Actions",
                            id: "actions",
                            width: "12rem",
                        },
                    ]}
                    compact
                    emptyMessage={bookmarkedOnly ? "No saved properties matched the current filter." : "No properties are being tracked yet."}
                    getRowId={(item) => item.id}
                    initialSortColumnId={"price-per-square-meter"}
                    initialSortDirection={"asc"}
                    items={filteredRows}
                    onRowClick={(item) => { void navigate(`/properties/${item.id}`); }}
                    pageSize={25}
                    rowLabel={(item) => `Open property ${item.label}`}
                />
            ) : null}

            <ConfirmDialog
                confirmLabel={bulkAction === "run" ? `Run ${selectedPropertyIds.length} properties` : `Pause ${selectedPropertyIds.length} schedules`}
                description={bulkAction === null
                    ? ""
                    : bulkAction === "run"
                        ? `Trigger a manual run for ${selectedPropertyIds.length} selected properties.`
                        : "Set the selected properties to manual-only by clearing their automatic schedule."}
                isPending={bulkRunMutation.isPending || bulkPauseMutation.isPending}
                onConfirm={() => {
                    if (bulkAction === "run") {
                        bulkRunMutation.mutate();
                        return;
                    }

                    if (bulkAction === "pause") {
                        bulkPauseMutation.mutate();
                    }
                }}
                onOpenChange={(open) => {
                    if (!open && !bulkRunMutation.isPending && !bulkPauseMutation.isPending) {
                        setBulkAction(null);
                    }
                }}
                open={bulkAction !== null}
                title={bulkAction === "run" ? "Run selected properties" : "Pause selected schedules"}
            />

            <ConfirmDialog
                confirmLabel={"Delete property"}
                description={deleteTarget === null ? "" : `Delete ${deleteTarget.label !== "" ? deleteTarget.label : deleteTarget.url}? This also removes its run history, alerts, bookmarks, and extraction configs.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    if (deleteTarget !== null) {
                        deleteMutation.mutate(deleteTarget.id);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
                open={deleteTarget !== null}
                title={"Delete property"}
            />
        </>
    );
};

const buildPropertyTableRow = (
    property: Property,
    latestRun: Run | undefined,
    tags: readonly Tag[],
    isBookmarked: boolean,
): PropertyTableRow => {
    const price = readRunNumber(latestRun, ["price", "price_amount", "listing_price", "asking_price"]);
    const sizeSquareMeters = readRunNumber(latestRun, ["price_m2_area", "area_m2", "size_m2", "surface_m2", "m2", "area", "size"]);
    const bedrooms = readRunNumber(latestRun, ["bedrooms", "beds", "bedroom_count"]);
    const rooms = readRunNumber(latestRun, ["rooms", "room_count"]);
    const pricePerSquareMeter = readRunNumber(latestRun, ["price_per_m2", "eur_m2", "price_per_sqm", "price_m2"])
        ?? (price !== undefined && sizeSquareMeters !== undefined && sizeSquareMeters > 0 ? price / sizeSquareMeters : undefined);
    const location = readRunText(latestRun, ["location", "district", "neighborhood", "city"]);

    const facts = [
        sizeSquareMeters !== undefined ? `${formatCompactNumber(sizeSquareMeters)} m²` : undefined,
        bedrooms !== undefined ? `${Math.round(bedrooms)} bd` : undefined,
        rooms !== undefined ? `${Math.round(rooms)} rm` : undefined,
        property.metadata?.priority_level !== undefined && property.metadata.priority_level.trim() !== "" ? property.metadata.priority_level : undefined,
    ].filter((value): value is string => value !== undefined);

    const signals: SignalBadge[] = [];
    if (price !== undefined && property.metadata?.target_price !== undefined) {
        if (price <= property.metadata.target_price) {
            signals.push({ label: "Below target", tone: "success" });
        } else if (price >= property.metadata.target_price * 1.1) {
            signals.push({ label: "Above target", tone: "warning" });
        }
    }

    if (latestRun?.change_flags?.price === true) {
        signals.push({ label: "Price updated", tone: "warning" });
    }

    if (property.status !== "active") {
        signals.push({ label: "Needs review", tone: statusTone(property.status) === "danger" ? "danger" : "warning" });
    }

    if (isBookmarked) {
        signals.push({ label: "Saved", tone: "neutral" });
    }

    if (signals.length === 0) {
        signals.push({ label: "Stable", tone: "success" });
    }

    return {
        bedrooms,
        facts,
        id: property.id,
        isBookmarked,
        label: property.label !== "" ? property.label : property.url,
        lastSeen: latestRun?.observed_at,
        location,
        price,
        pricePerSquareMeter,
        property,
        signals,
        sizeSquareMeters,
        tags,
        trackingLabel: trackingState(property),
        url: property.url,
    };
};

const trackingState = (property: Property): string => {
    if (property.next_run_at !== undefined) {
        return `Next ${formatDateTime(property.next_run_at)}`;
    }

    return property.schedule_interval_seconds !== undefined && property.schedule_interval_seconds > 0 ? "Scheduled" : "Manual only";
};

const readRunText = (latestRun: Run | undefined, keys: readonly string[]): string | undefined => {
    if (latestRun === undefined) {
        return undefined;
    }

    for (const key of keys) {
        const raw = latestRun.values[key];
        if (raw !== undefined && raw.trim() !== "") {
            return raw.trim();
        }
    }

    return undefined;
};

const readRunNumber = (latestRun: Run | undefined, keys: readonly string[]): number | undefined => {
    for (const key of keys) {
        const value = readRunText(latestRun, [key]);
        if (value === undefined) {
            continue;
        }

        const parsed = parseNumeric(value);
        if (parsed !== undefined) {
            return parsed;
        }
    }

    return undefined;
};

const formatMoney = (value: number): string => {
    return new Intl.NumberFormat("en", {
        currency: "EUR",
        maximumFractionDigits: 0,
        style: "currency",
    }).format(value);
};

const formatCompactNumber = (value: number): string => {
    return value.toLocaleString("en", {
        maximumFractionDigits: value >= 100 ? 0 : 1,
        minimumFractionDigits: 0,
    });
};
