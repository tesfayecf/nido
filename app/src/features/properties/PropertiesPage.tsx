import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

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
import { formatDateTime } from "@/lib/format/date";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { deleteProperty, ingestProperty, listProperties } from "@/services/properties/properties.service";
import type { Property, PropertyStatus } from "@/services/properties/properties.types";

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
    const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
    const propertiesQuery = useQuery({
        queryFn: listProperties,
        queryKey: propertyKeys.list(),
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
