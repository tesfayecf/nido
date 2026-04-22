import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { ListRow, ListRowMain } from "@/components/ui/ListRow";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { alertRuleKeys } from "@/services/alert-rules/alert-rules.keys";
import { listAlertRules } from "@/services/alert-rules/alert-rules.service";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { readNonNegativeNumber } from "@/lib/forms/number";
import { formatDateTime } from "@/lib/format/date";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { propertyKeys } from "@/services/properties/properties.keys";
import {
    buildPreviewFieldMap,
    createDefaultSelectorDrafts,
    createEmptySelectorDraft,
    draftToSelector,
    selectorToDraft,
    validateSelectorDrafts,
    type SelectorFieldDraft,
} from "@/features/selectors/selectorSchema";
import {
    createProperty,
    deleteProperty,
    getProperty,
    getPropertyConfig,
    ingestProperty,
    listPropertySnapshots,
    previewExtraction,
    updateProperty,
    upsertPropertyConfig,
} from "@/services/properties/properties.service";
import type { PropertyPreviewFieldResult } from "@/services/properties/properties.types";

export const PropertyDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const { propertyId } = useParams<{ propertyId: string; }>();
    const isCreateMode = propertyId === undefined || propertyId === "new";
    const resolvedId = isCreateMode ? "" : propertyId;

    const [url, setUrl] = useState("");
    const [label, setLabel] = useState("");
    const [sourceId, setSourceId] = useState("");
    const [scheduleInterval, setScheduleInterval] = useState(0);
    const [retryMaxAttempts, setRetryMaxAttempts] = useState(1);
    const [retryBackoffMillis, setRetryBackoffMillis] = useState(500);
    const [fieldRows, setFieldRows] = useState<SelectorFieldDraft[]>(createDefaultSelectorDrafts);
    const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
    const [previewMap, setPreviewMap] = useState<Map<string, PropertyPreviewFieldResult>>(new Map());
    const [previewFailures, setPreviewFailures] = useState<string[]>([]);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const propertyQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => getProperty(resolvedId),
        queryKey: propertyKeys.detail(resolvedId),
    });
    const configQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => getPropertyConfig(resolvedId),
        queryKey: propertyKeys.config(resolvedId),
    });
    const snapshotsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertySnapshots(resolvedId, 20),
        queryKey: propertyKeys.snapshots(resolvedId),
    });
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const bookmarksQuery = useQuery({
        queryFn: listBookmarks,
        queryKey: bookmarkKeys.all(),
    });
    const alertsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: listAlertRules,
        queryKey: alertRuleKeys.all(),
    });

    useEffect(() => {
        if (propertyQuery.data !== undefined) {
            setUrl(propertyQuery.data.url);
            setLabel(propertyQuery.data.label);
            setSourceId(propertyQuery.data.source_id ?? "");
            setScheduleInterval(propertyQuery.data.schedule_interval_seconds ?? 0);
            setRetryMaxAttempts(propertyQuery.data.retry_max_attempts ?? 1);
            setRetryBackoffMillis(propertyQuery.data.retry_backoff_millis ?? 500);
        }
    }, [propertyQuery.data]);

    useEffect(() => {
        if (configQuery.data?.fields !== undefined && configQuery.data.fields.length > 0) {
            setFieldRows(configQuery.data.fields.map(selectorToDraft));
        }
    }, [configQuery.data]);

    const savePropertyMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                label,
                retry_backoff_millis: retryBackoffMillis,
                retry_max_attempts: retryMaxAttempts,
                schedule_interval_seconds: scheduleInterval,
                source_id: sourceId.trim() !== "" ? sourceId.trim() : undefined,
                url,
            };

            if (isCreateMode) {
                return createProperty(payload);
            }

            return updateProperty(resolvedId, payload);
        },
        onSuccess(data) {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            pushToast(isCreateMode ? "Property created." : "Property updated.", "success");
            if (isCreateMode) {
                void navigate(`/properties/${data.id}`, { replace: true });
                return;
            }

            void queryClient.invalidateQueries({ queryKey: propertyKeys.detail(resolvedId) });
            setEditOpen(false);
        },
    });
    const saveConfigMutation = useMutation({
        mutationFn: () => upsertPropertyConfig(
            resolvedId,
            fieldRows
                .filter((row) => row.name.trim() !== "")
                .map(draftToSelector),
        ),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.config(resolvedId) });
            pushToast("Configuration saved.", "success");
        },
    });
    const previewMutation = useMutation({
        mutationFn: () => previewExtraction({
            fields: fieldRows
                .map(draftToSelector)
                .filter((field) => field.name !== ""),
            url,
        }),
        onSuccess(data) {
            setPreviewValues(data.values);
            setPreviewMap(buildPreviewFieldMap(data.fields));
            setPreviewFailures(data.failures ?? []);
        },
        onError() {
            setPreviewValues({});
            setPreviewMap(new Map());
            setPreviewFailures(["Extraction preview failed. Check the URL and selectors."]);
        },
    });
    const ingestMutation = useMutation({
        mutationFn: () => ingestProperty(resolvedId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.detail(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.snapshots(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
            pushToast("Run started.", "success");
        },
    });
    const bookmarkMutation = useMutation({
        mutationFn: async () => {
            if (resolvedId === "") {
                return;
            }

            const bookmarkedIds = new Set((bookmarksQuery.data ?? []).map((item) => item.property_id));
            if (bookmarkedIds.has(resolvedId)) {
                await deleteBookmark(resolvedId);
                return;
            }

            await createBookmark(resolvedId);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
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
            pushToast("Property deleted.", "success");
            void navigate("/properties");
        },
    });

    const latestSnapshot = snapshotsQuery.data?.[0];
    const propertyAlerts = useMemo(() => {
        return (alertsQuery.data ?? []).filter((rule) => rule.property_id === resolvedId);
    }, [alertsQuery.data, resolvedId]);
    const isBookmarked = (bookmarksQuery.data ?? []).some((item) => item.property_id === resolvedId);
    const validationMessages = useMemo(() => validateSelectorDrafts(fieldRows), [fieldRows]);
    const extractedValueRows = useMemo(() => {
        return Object.entries(latestSnapshot?.values ?? {}).map(([field, value]) => ({ field, value }));
    }, [latestSnapshot?.values]);
    const recentRuns = snapshotsQuery.data ?? [];

    const editorContent = (
        <PageStack>
            <PageCard
                action={!isCreateMode ? <Button as={Link} to={"/properties"} variant={"secondary"}>{"Back to properties"}</Button> : undefined}
                description={isCreateMode ? "Add a property URL and optionally assign a reusable source template." : "Update the property URL, template assignment, and run cadence."}
                title={isCreateMode ? "Add Property" : "Edit Property"}
            >
                {propertyQuery.isError ? <ErrorBanner>{"Could not load property."}</ErrorBanner> : null}
                <FormGrid as={"div"} variant={"two-column"}>
                    <Field fullWidth label={"URL"}>
                        <Input id={"prop-url"} onChange={(event) => { setUrl(event.target.value); }} placeholder={"https://example.com/property/123"} type={"url"} value={url} />
                    </Field>
                    <Field label={"Label"}>
                        <Input id={"prop-label"} onChange={(event) => { setLabel(event.target.value); }} placeholder={"Optional display name"} type={"text"} value={label} />
                    </Field>
                    <Field label={"Source template"}>
                        <Select id={"prop-source"} onChange={(event) => { setSourceId(event.target.value); }} value={sourceId}>
                            <option value={""}>{"No template"}</option>
                            {(sourcesQuery.data ?? []).map((source) => {
                                return <option key={source.id} value={source.id}>{source.name}</option>;
                            })}
                        </Select>
                    </Field>
                    <Field label={"Schedule interval (s)"}>
                        <Input id={"prop-schedule"} min={0} onChange={(event) => { setScheduleInterval(readNonNegativeNumber(event.target.value, 0)); }} type={"number"} value={scheduleInterval} />
                    </Field>
                    <Field label={"Retry attempts"}>
                        <Input id={"prop-retry"} min={1} onChange={(event) => { setRetryMaxAttempts(readNonNegativeNumber(event.target.value, 1)); }} type={"number"} value={retryMaxAttempts} />
                    </Field>
                    <Field label={"Retry backoff (ms)"}>
                        <Input id={"prop-backoff"} min={0} onChange={(event) => { setRetryBackoffMillis(readNonNegativeNumber(event.target.value, 500)); }} type={"number"} value={retryBackoffMillis} />
                    </Field>
                </FormGrid>
                {savePropertyMutation.isError ? <ErrorBanner>{"Could not save property. Check the URL and selected source."}</ErrorBanner> : null}
                <ActionGroup>
                    <Button disabled={savePropertyMutation.isPending || url.trim() === ""} onClick={() => { savePropertyMutation.mutate(); }}>
                        {savePropertyMutation.isPending ? "Saving..." : isCreateMode ? "Create property" : "Save changes"}
                    </Button>
                    {!isCreateMode ? (
                        <Button disabled={bookmarkMutation.isPending} onClick={() => { bookmarkMutation.mutate(); }} variant={"secondary"}>
                            {isBookmarked ? "Remove bookmark" : "Bookmark"}
                        </Button>
                    ) : null}
                </ActionGroup>
            </PageCard>

            {!isCreateMode ? (
                <PageCard description={"Edit the selectors that this property should use after inheriting from its source template."} title={"Extraction Configuration"}>
                    <SelectorBuilder fields={fieldRows} onChange={setFieldRows} previewByFieldName={previewMap} />
                    {fieldRows.length === 0 ? <EmptyState message={"No fields defined yet. Add a field to start extracting data."} /> : null}
                    <ActionGroup>
                        <Button onClick={() => { setFieldRows((rows) => [...rows, createEmptySelectorDraft()]); }} variant={"secondary"}>{"Add field"}</Button>
                        <Button disabled={previewMutation.isPending || url.trim() === "" || validationMessages.length > 0} onClick={() => { previewMutation.mutate(); }} variant={"secondary"}>{previewMutation.isPending ? "Previewing..." : "Preview extraction"}</Button>
                        <Button disabled={saveConfigMutation.isPending || validationMessages.length > 0} onClick={() => { saveConfigMutation.mutate(); }}>{saveConfigMutation.isPending ? "Saving..." : "Save configuration"}</Button>
                    </ActionGroup>
                    {validationMessages.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {validationMessages.map((message) => <ErrorBanner key={message}>{message}</ErrorBanner>)}
                        </div>
                    ) : null}
                    {saveConfigMutation.isError ? <ErrorBanner>{"Could not save configuration."}</ErrorBanner> : null}
                    {previewFailures.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {previewFailures.map((failure) => <ErrorBanner key={failure}>{failure}</ErrorBanner>)}
                        </div>
                    ) : null}
                    {Object.keys(previewValues).length > 0 ? (
                        <div className={"selector-builder__results"}>
                            {Object.entries(previewValues).map(([fieldName, value]) => (
                                <article className={"selector-builder__result-card"} key={fieldName}>
                                    <span className={"selector-builder__result-label"}>{fieldName}</span>
                                    <strong className={"selector-builder__result-value"}>{value}</strong>
                                </article>
                            ))}
                        </div>
                    ) : null}
                </PageCard>
            ) : null}
        </PageStack>
    );

    if (isCreateMode) {
        return editorContent;
    }

    return (
        <>
            <PageStack>
                <PageCard
                    action={(
                        <ActionGroup>
                            <Button as={Link} to={"/properties"} variant={"secondary"}>{"Back"}</Button>
                            <Button onClick={() => { setEditOpen(true); }} variant={"secondary"}>{"Edit"}</Button>
                            <Button onClick={() => { setDeleteOpen(true); }} variant={"secondary"}>{"Delete"}</Button>
                        </ActionGroup>
                    )}
                    description={"Read the latest tracked state first, then open the modal editor only when you need to make changes."}
                    title={propertyQuery.data?.label !== undefined && propertyQuery.data.label !== "" ? propertyQuery.data.label : propertyQuery.data?.url ?? "Property"}
                >
                    {propertyQuery.isError ? <ErrorBanner>{"Could not load property."}</ErrorBanner> : null}
                    {propertyQuery.data !== undefined ? (
                        <KeyValueGrid compact>
                            <KeyValuePair label={"URL"} value={propertyQuery.data.url} />
                            <KeyValuePair label={"Status"} value={<StatusBadge tone={propertyQuery.data.status === "active" ? "success" : propertyQuery.data.status === "degraded" ? "warning" : propertyQuery.data.status === "inactive" ? "danger" : "neutral"} value={propertyQuery.data.status} />} />
                            <KeyValuePair label={"Source"} value={sourcesQuery.data?.find((source) => source.id === propertyQuery.data?.source_id)?.name ?? "No template"} />
                            <KeyValuePair label={"Updated"} value={propertyQuery.data.updated_at === undefined ? "—" : formatDateTime(propertyQuery.data.updated_at)} />
                            <KeyValuePair label={"Last run"} value={propertyQuery.data.last_run_at === undefined ? "No runs yet" : formatDateTime(propertyQuery.data.last_run_at)} />
                            <KeyValuePair label={"Bookmark"} value={isBookmarked ? "Bookmarked" : "Not bookmarked"} />
                        </KeyValueGrid>
                    ) : null}
                </PageCard>

                <PageCard
                    action={(
                        <ActionGroup>
                            <Button disabled={bookmarkMutation.isPending} onClick={() => { bookmarkMutation.mutate(); }} variant={"secondary"}>
                                {isBookmarked ? "Remove bookmark" : "Bookmark"}
                            </Button>
                            <Button disabled={ingestMutation.isPending} onClick={() => { ingestMutation.mutate(); }}>
                                {ingestMutation.isPending ? "Running..." : "Run now"}
                            </Button>
                            <Button as={Link} to={`/runs?property_id=${resolvedId}`} variant={"secondary"}>{"View history"}</Button>
                        </ActionGroup>
                    )}
                    description={"The latest successful or failed snapshot is shown in a dense read-only table."}
                    title={"Current Extracted Values"}
                >
                    {latestSnapshot === undefined ? <EmptyState message={"No runs have been recorded for this property yet."} /> : (
                        <>
                            <KeyValueGrid compact>
                                <KeyValuePair label={"Snapshot status"} value={<StatusBadge tone={latestSnapshot.is_valid ? "success" : "warning"} value={latestSnapshot.is_valid ? "valid" : "invalid"} />} />
                                <KeyValuePair label={"Observed at"} value={formatDateTime(latestSnapshot.observed_at)} />
                            </KeyValueGrid>
                            {latestSnapshot.error_message !== undefined && latestSnapshot.error_message !== "" ? <ErrorBanner>{latestSnapshot.error_message}</ErrorBanner> : null}
                            <DataTable
                                caption={"Current extracted values"}
                                columns={[
                                    { cell: (item) => item.field, header: "Field", id: "field", sortValue: (item) => item.field },
                                    { cell: (item) => item.value, header: "Value", id: "value" },
                                ]}
                                compact
                                emptyMessage={"No extracted values are available for the latest run."}
                                getRowId={(item) => item.field}
                                items={extractedValueRows}
                                pageSize={8}
                            />
                        </>
                    )}
                </PageCard>

                <PageCard description={"Recent runs stay directly attached to the property for fast scanning."} title={"Recent Runs"}>
                    <DataTable
                        caption={"Recent property runs"}
                        columns={[
                            { cell: (item) => item.id, header: "Run", id: "id", sortValue: (item) => item.id },
                            { cell: (item) => formatDateTime(item.observed_at), header: "Observed", id: "observed_at", sortValue: (item) => item.observed_at },
                            { cell: (item) => <StatusBadge tone={item.is_valid ? "success" : "warning"} value={item.is_valid ? "valid" : "invalid"} />, header: "Status", id: "status" },
                            { align: "right", cell: (item) => `${Object.keys(item.values).length}`, header: "Fields", id: "fields", sortValue: (item) => Object.keys(item.values).length },
                        ]}
                        compact
                        emptyMessage={"No runs have been recorded for this property yet."}
                        getRowId={(item) => item.id}
                        items={recentRuns}
                        onRowClick={(item) => { void navigate(`/runs/${item.id}`); }}
                        pageSize={8}
                        rowLabel={(item) => `Open run ${item.id}`}
                    />
                </PageCard>

                <PageCard description={"Alerts trigger when new runs meet property-level conditions."} title={"Alerts"}>
                    {propertyAlerts.length === 0 ? <EmptyState message={"No alerts are linked to this property yet."} /> : (
                        <ItemList>
                            {propertyAlerts.map((rule) => {
                                return (
                                    <ListRow key={rule.id}>
                                        <ListRowMain>
                                            <div>
                                                <h3 className={"list-row__title"}>{rule.rule_type}</h3>
                                                <p className={"list-row__meta"}>{rule.threshold_amount === undefined ? "No threshold" : `Threshold ${rule.threshold_amount}`}</p>
                                            </div>
                                            <strong className={"list-row__price"}>{rule.enabled ? "Active" : "Inactive"}</strong>
                                        </ListRowMain>
                                    </ListRow>
                                );
                            })}
                        </ItemList>
                    )}
                </PageCard>
            </PageStack>

            <Dialog onOpenChange={setEditOpen} open={editOpen} title={"Edit property"}>
                {editorContent}
            </Dialog>
            <ConfirmDialog
                confirmLabel={"Delete property"}
                description={`Delete ${propertyQuery.data?.label !== undefined && propertyQuery.data.label !== "" ? propertyQuery.data.label : propertyQuery.data?.url ?? "this property"}? This also removes its runs, alerts, bookmarks, and extraction config.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    deleteMutation.mutate(resolvedId);
                }}
                onOpenChange={setDeleteOpen}
                open={deleteOpen}
                title={"Delete property"}
            />
        </>
    );
};
