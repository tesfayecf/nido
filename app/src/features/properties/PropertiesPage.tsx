import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { readNonNegativeNumber } from "@/lib/forms/number";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { createProperty, deleteProperty, ingestProperty, listProperties } from "@/services/properties/properties.service";
import type { Property, PropertyStatus } from "@/services/properties/properties.types";

interface PropertyDraft {
    readonly label: string;
    readonly scheduleIntervalSeconds: number;
    readonly sourceId: string;
    readonly url: string;
}

const defaultDraft = (): PropertyDraft => ({
    label: "",
    scheduleIntervalSeconds: 0,
    sourceId: "",
    url: "",
});

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
    const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
    const [draft, setDraft] = useState<PropertyDraft>(defaultDraft);
    const propertiesQuery = useQuery({
        queryFn: listProperties,
        queryKey: propertyKeys.list(),
    });
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const bookmarksQuery = useQuery({
        queryFn: listBookmarks,
        queryKey: bookmarkKeys.all(),
    });
    const createMutation = useMutation({
        mutationFn: () => createProperty({
            label: draft.label.trim(),
            schedule_interval_seconds: draft.scheduleIntervalSeconds > 0 ? draft.scheduleIntervalSeconds : undefined,
            source_id: draft.sourceId.trim() === "" ? undefined : draft.sourceId,
            url: draft.url.trim(),
        }),
        onError() {
            pushToast("Could not create property.", "error");
        },
        onSuccess(property) {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            setCreateOpen(false);
            setDraft(defaultDraft());
            pushToast("Property created.", "success");
            void navigate(`/properties/${property.id}`);
        },
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
                action={<Button onClick={() => { setCreateOpen(true); }}>{"Create property"}</Button>}
                description={"Manage tracked URLs in one dense table with explicit run, bookmark, history, and delete actions."}
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
                    <span className={"muted-copy"}>{`${properties.length} tracked properties`}</span>
                </div>
            </PageCard>

            <PageCard description={"Select a row to open the full detail view."} title={"Tracked Properties"}>
                {propertiesQuery.isLoading ? <p className={"state-message state-message--loading"}>{"Loading properties..."}</p> : null}
                {propertiesQuery.isError ? <ErrorBanner>{"Could not load properties."}</ErrorBanner> : null}
                {!propertiesQuery.isLoading && !propertiesQuery.isError ? (
                    <DataTable
                        caption={"Tracked properties"}
                        columns={[
                            {
                                cell: (item) => (
                                    <div>
                                        <strong>{item.label !== "" ? item.label : item.url}</strong>
                                        <p className={"table-subcopy"}>{item.url}</p>
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
                            },
                            {
                                cell: (item) => trackingState(item),
                                header: "Tracking",
                                id: "tracking",
                                sortValue: (item) => item.next_run_at ?? "",
                            },
                            {
                                cell: (item) => lastExtractionLabel(item),
                                header: "Last extraction",
                                id: "last_extraction",
                                sortValue: (item) => item.last_run_at ?? "",
                            },
                            {
                                cell: (item) => item.updated_at === undefined ? "—" : formatDateTime(item.updated_at),
                                header: "Updated",
                                id: "updated_at",
                                sortValue: (item) => item.updated_at ?? "",
                            },
                            {
                                cell: (item) => (
                                    <div className={"action-group"} onClick={(event) => { event.stopPropagation(); }}>
                                        <Button
                                            onClick={() => {
                                                bookmarkMutation.mutate({ isBookmarked: bookmarkedIds.has(item.id), propertyId: item.id });
                                            }}
                                            size={"small"}
                                            variant={"secondary"}
                                        >
                                            {bookmarkedIds.has(item.id) ? "Unbookmark" : "Bookmark"}
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                void navigate(`/runs?property_id=${encodeURIComponent(item.id)}`);
                                            }}
                                            size={"small"}
                                            variant={"secondary"}
                                        >
                                            {"History"}
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                ingestMutation.mutate({ propertyId: item.id });
                                            }}
                                            size={"small"}
                                            variant={"secondary"}
                                        >
                                            {"Run now"}
                                        </Button>
                                        <Button onClick={() => { setDeleteTarget(item); }} size={"small"} variant={"secondary"}>{"Delete"}</Button>
                                    </div>
                                ),
                                header: "Actions",
                                id: "actions",
                            },
                        ]}
                        compact
                        emptyMessage={bookmarkedOnly ? "No bookmarked properties matched the current filter." : "No properties are being tracked yet."}
                        getRowId={(item) => item.id}
                        items={properties}
                        onRowClick={(item) => { void navigate(`/properties/${item.id}`); }}
                        pageSize={12}
                        rowLabel={(item) => `Open property ${item.label !== "" ? item.label : item.url}`}
                    />
                ) : null}
            </PageCard>

            <Dialog
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) {
                        setDraft(defaultDraft());
                    }
                }}
                open={createOpen}
                title={"Create property"}
            >
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        createMutation.mutate();
                    }}
                >
                    <Field fullWidth label={"URL"}>
                        <Input
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, url: event.target.value }));
                            }}
                            placeholder={"https://example.com/property/123"}
                            type={"url"}
                            value={draft.url}
                        />
                    </Field>
                    <Field label={"Label"}>
                        <Input
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, label: event.target.value }));
                            }}
                            placeholder={"Optional display name"}
                            value={draft.label}
                        />
                    </Field>
                    <Field label={"Source template"}>
                        <Select
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, sourceId: event.target.value }));
                            }}
                            value={draft.sourceId}
                        >
                            <option value={""}>{"No template"}</option>
                            {(sourcesQuery.data ?? []).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                        </Select>
                    </Field>
                    <Field label={"Schedule interval (s)"}>
                        <Input
                            min={0}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, scheduleIntervalSeconds: readNonNegativeNumber(event.target.value, 0) }));
                            }}
                            type={"number"}
                            value={draft.scheduleIntervalSeconds}
                        />
                    </Field>
                    <div className={"action-group"}>
                        <Button onClick={() => { setCreateOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button disabled={draft.url.trim() === ""} isLoading={createMutation.isPending} type={"submit"}>
                            {"Create property"}
                        </Button>
                    </div>
                </FormGrid>
            </Dialog>

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
