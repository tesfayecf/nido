import { useMemo, useState } from "react";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageCard } from "@/components/ui/PageCard";
import { RowActions } from "@/components/ui/RowActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { TagBadge } from "@/components/tags/TagBadge";
import { TagFilter } from "@/components/tags/TagFilter";
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { deleteProperty, ingestProperty, listProperties } from "@/services/properties/properties.service";
import type { Property, PropertyStatus } from "@/services/properties/properties.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags, listTags } from "@/services/tags/tags.service";

const DEFAULT_TAG_MATCH = "any" as const;

const statusTone = (status: PropertyStatus): "danger" | "neutral" | "success" | "warning" => {
    switch (status) {
        case "active":
            return "success";
        case "degraded":
            return "warning";
        case "inactive":
            return "neutral";
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
    
    const tagIdsFromUrl = searchParams.getAll("tag");
    const tagMatchFromUrl = (searchParams.get("match") ?? DEFAULT_TAG_MATCH) as "any" | "all";
    
    const propertiesQuery = useQuery({
        queryFn: () => listProperties({
            tagIds: tagIdsFromUrl.length > 0 ? tagIdsFromUrl : undefined,
            tagMatch: tagIdsFromUrl.length > 0 ? tagMatchFromUrl : undefined,
        }),
        queryKey: [...propertyKeys.list(), { tagIds: tagIdsFromUrl, tagMatch: tagMatchFromUrl }],
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
    
    const propertyTagsMap = useMemo(() => {
        const map = new Map<string, string[]>();
        (propertiesQuery.data ?? []).forEach((property, index) => {
            const tags = propertyTagQueries[index]?.data ?? [];
            map.set(property.id, tags.map((tag) => tag.id));
        });
        return map;
    }, [propertiesQuery.data, propertyTagQueries]);
    
    const allTags = useMemo(() => allTagsQuery.data ?? [], [allTagsQuery.data]);
    
    const handleTagFilterChange = (tagIds: string[], tagMatch: "any" | "all"): void => {
        const params = new URLSearchParams();
        tagIds.forEach((id) => {
            params.append("tag", id);
        });
        if (tagIds.length > 0 && tagMatch !== DEFAULT_TAG_MATCH) {
            params.set("match", tagMatch);
        }

        setSearchParams(params);
    };

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

    const bookmarkedIds = useMemo(() => new Set((bookmarksQuery.data ?? []).map((item) => item.property_id)), [bookmarksQuery.data]);
    const properties = useMemo(() => {
        return (propertiesQuery.data ?? []).filter((item) => !bookmarkedOnly || bookmarkedIds.has(item.id));
    }, [bookmarkedIds, bookmarkedOnly, propertiesQuery.data]);

    return (
        <>
            <PageCard
                action={(
                    <Button iconBefore={<Icon name={"plus"} />} onClick={() => { void navigate("/properties/new"); }}>
                        {"New property"}
                    </Button>
                )}
                title={"Properties"}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <TagFilter
                        onChange={handleTagFilterChange}
                        selectedTagIds={tagIdsFromUrl}
                        tagMatch={tagMatchFromUrl}
                    />
                    
                    <div className={"toolbar"}>
                        <Field className={"field--checkbox-compact"} label={"Bookmarked only"} variant={"checkbox"}>
                            <input
                                checked={bookmarkedOnly}
                                onChange={(event) => {
                                    setBookmarkedOnly(event.target.checked);
                                }}
                                type={"checkbox"}
                            />
                        </Field>
                        <span className={"muted-copy"}>{`${properties.length} tracked`}</span>
                    </div>
                </div>
            </PageCard>

            {propertiesQuery.isLoading ? <p className={"state-message state-message--loading"}>{"Loading properties..."}</p> : null}
            {propertiesQuery.isError ? <ErrorBanner>{"Could not load properties."}</ErrorBanner> : null}
            {!propertiesQuery.isLoading && !propertiesQuery.isError ? (
                <DataTable
                    caption={"Tracked properties"}
                    columns={[
                        {
                            cell: (item) => (
                                <div className={"data-table__primary"}>
                                    <strong>{item.label !== "" ? item.label : item.url}</strong>
                                    <span className={"table-subcopy"}>{item.url}</span>
                                </div>
                            ),
                            header: "Property",
                            id: "property",
                            sortValue: (item) => item.label !== "" ? item.label : item.url,
                        },
                        {
                            cell: (item) => <StatusBadge tone={statusTone(item.status)} value={item.status} />,
                            header: "Status",
                            id: "status",
                            sortValue: (item) => item.status,
                            width: "8rem",
                        },
                        {
                            cell: (item) => {
                                const tagIds = propertyTagsMap.get(item.id) ?? [];
                                const propertyTags = allTags.filter((tag) => tagIds.includes(tag.id));
                                if (propertyTags.length === 0) {
                                    return <span className={"muted-copy"}>{"—"}</span>;
                                }

                                return (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                        {propertyTags.map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                                    </div>
                                );
                            },
                            header: "Tags",
                            id: "tags",
                            width: "12rem",
                        },
                        {
                            cell: (item) => trackingState(item),
                            header: "Tracking",
                            id: "tracking",
                            sortValue: (item) => item.next_run_at ?? "",
                            width: "12rem",
                        },
                        {
                            cell: (item) => lastExtractionLabel(item),
                            header: "Last extraction",
                            id: "last_extraction",
                            sortValue: (item) => item.last_run_at ?? "",
                            width: "11rem",
                        },
                        {
                            cell: (item) => item.updated_at === undefined ? "—" : formatDateTime(item.updated_at),
                            header: "Updated",
                            id: "updated_at",
                            sortValue: (item) => item.updated_at ?? "",
                            width: "11rem",
                        },
                        {
                            align: "right",
                            cell: (item) => {
                                const isBookmarked = bookmarkedIds.has(item.id);
                                return (
                                    <RowActions
                                        menuItems={[
                                            {
                                                label: isBookmarked ? "Remove bookmark" : "Bookmark",
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
                                            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
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
                                            onClick={() => { setDeleteTarget(item); }}
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
                    emptyMessage={bookmarkedOnly ? "No bookmarked properties matched the current filter." : "No properties are being tracked yet."}
                    getRowId={(item) => item.id}
                    items={properties}
                    onRowClick={(item) => { void navigate(`/properties/${item.id}`); }}
                    pageSize={20}
                    rowLabel={(item) => `Open property ${item.label !== "" ? item.label : item.url}`}
                />
            ) : null}

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

const trackingState = (property: Property): string => {
    if (property.next_run_at !== undefined) {
        return `Next ${formatDateTime(property.next_run_at)}`;
    }

    return property.schedule_interval_seconds !== undefined && property.schedule_interval_seconds > 0 ? "Scheduled" : "Manual only";
};

const lastExtractionLabel = (property: Property): string => {
    if (property.last_run_at === undefined) {
        return "No runs yet";
    }

    return formatDateTime(property.last_run_at);
};
