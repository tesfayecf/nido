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
import { RowActions } from "@/components/ui/RowActions";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { CopyButton } from "@/components/ui/CopyButton";
import { useToast } from "@/components/ui/ToastProvider";
import { TagBadge } from "@/components/tags/TagBadge";
import { TagPicker } from "@/components/tags/TagPicker";
import { PropertyAlertCreateDialog } from "@/features/engagement/PropertyAlertCreateDialog";
import {
    durationDraftFromSeconds,
    durationDraftToSeconds,
    formatDurationFromSeconds,
    schedulePresets,
    type DurationUnit,
} from "@/features/properties/propertySchedule";
import { getRuleTypeLabel, getRuleTypeLogic } from "@/services/alert-rules/alert-rules.constants";
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
    listPropertyRuns,
    listPropertySnapshots,
    previewExtraction,
    updateProperty,
    upsertPropertyConfig,
} from "@/services/properties/properties.service";
import type { PropertyPreviewFieldResult, PropertyRunStatus } from "@/services/properties/properties.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags, setPropertyTags } from "@/services/tags/tags.service";

const PROPERTY_RUNS_REFETCH_INTERVAL_MS = 5000;
const MIN_RETRY_BACKOFF_MS = 500;

const runStatusTone = (status: PropertyRunStatus): "danger" | "neutral" | "success" | "warning" => {
    switch (status) {
        case "success":
            return "success";
        case "failed":
            return "danger";
        case "running":
            return "warning";
        case "pending":
        default:
            return "neutral";
    }
};

const scheduleStatusLabel = (
    scheduleIntervalSeconds: number | undefined,
    latestRun: { readonly attempt_count: number; readonly max_attempts: number; readonly status: PropertyRunStatus; } | undefined,
): string => {
    if (latestRun?.status === "running") {
        return "Running";
    }
    if (latestRun?.status === "failed") {
        return latestRun.attempt_count < latestRun.max_attempts
            ? `Failed · retry ${latestRun.attempt_count + 1} of ${latestRun.max_attempts} pending`
            : "Failed";
    }
    if (scheduleIntervalSeconds !== undefined && scheduleIntervalSeconds > 0) {
        return "Scheduled";
    }
    return "Manual only";
};

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
    const [scheduleIntervalValue, setScheduleIntervalValue] = useState("");
    const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState<DurationUnit>("minutes");
    const [retryMaxAttempts, setRetryMaxAttempts] = useState(1);
    const [retryBackoffMillis, setRetryBackoffMillis] = useState(500);
    const [fieldRows, setFieldRows] = useState<SelectorFieldDraft[]>(createDefaultSelectorDrafts);
    const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
    const [previewMap, setPreviewMap] = useState<Map<string, PropertyPreviewFieldResult>>(new Map());
    const [previewFailures, setPreviewFailures] = useState<string[]>([]);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [createAlertOpen, setCreateAlertOpen] = useState(false);
    const [tagsOpen, setTagsOpen] = useState(false);

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
    const propertyTagsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertyTags(resolvedId),
        queryKey: tagKeys.propertyTags(resolvedId),
    });
    const propertyRunsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertyRuns(resolvedId, 10),
        queryKey: propertyKeys.runs(resolvedId),
        refetchInterval: PROPERTY_RUNS_REFETCH_INTERVAL_MS,
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
            const scheduleDraft = durationDraftFromSeconds(propertyQuery.data.schedule_interval_seconds);
            setScheduleIntervalValue(scheduleDraft.value);
            setScheduleIntervalUnit(scheduleDraft.unit);
            setRetryMaxAttempts(propertyQuery.data.retry_max_attempts ?? 1);
            setRetryBackoffMillis(propertyQuery.data.retry_backoff_millis ?? 500);
        }
    }, [propertyQuery.data]);

    useEffect(() => {
        if (configQuery.data?.fields !== undefined && configQuery.data.fields.length > 0) {
            setFieldRows(configQuery.data.fields.map(selectorToDraft));
        }
    }, [configQuery.data]);

    const scheduleIntervalSeconds = durationDraftToSeconds(scheduleIntervalValue, scheduleIntervalUnit);
    const scheduleIntervalError = scheduleIntervalSeconds === null ? "Choose a run interval greater than zero." : undefined;
    const retryBackoffError = retryBackoffMillis < MIN_RETRY_BACKOFF_MS
        ? `Retry interval must be at least ${MIN_RETRY_BACKOFF_MS}ms.`
        : undefined;
    const propertySaveError = scheduleIntervalError ?? retryBackoffError;

    const savePropertyMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                label,
                retry_backoff_millis: retryBackoffMillis,
                retry_max_attempts: retryMaxAttempts,
                schedule_interval_seconds: scheduleIntervalSeconds ?? 0,
                source_id: sourceId.trim() !== "" ? sourceId.trim() : undefined,
                url,
            };

            if (isCreateMode) {
                return createProperty(payload);
            }

            return updateProperty(resolvedId, payload);
        },
        onSuccess(data) {
            queryClient.setQueryData(propertyKeys.detail(data.id), data);
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
    const updateTagsMutation = useMutation({
        mutationFn: (tagIds: string[]) => setPropertyTags(resolvedId, tagIds),
        onError() {
            pushToast("Could not update tags.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: tagKeys.propertyTags(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            setTagsOpen(false);
            pushToast("Tags updated.", "success");
        },
    });

    const latestSnapshot = snapshotsQuery.data?.[0];
    const latestAutomationRun = propertyRunsQuery.data?.[0];
    const propertyAlerts = useMemo(() => {
        return (alertsQuery.data ?? []).filter((rule) => rule.property_id === resolvedId);
    }, [alertsQuery.data, resolvedId]);
    const isBookmarked = (bookmarksQuery.data ?? []).some((item) => item.property_id === resolvedId);
    const validationMessages = useMemo(() => validateSelectorDrafts(fieldRows), [fieldRows]);
    const extractedValueRows = useMemo(() => {
        return Object.entries(latestSnapshot?.values ?? {}).map(([field, value]) => ({ field, value }));
    }, [latestSnapshot?.values]);
    const recentRuns = snapshotsQuery.data ?? [];
    const persistedScheduleSummary = useMemo(() => {
        if (propertyQuery.data?.schedule_interval_seconds === undefined || propertyQuery.data.schedule_interval_seconds <= 0) {
            return "Manual only";
        }
        return `Runs every ${formatDurationFromSeconds(propertyQuery.data.schedule_interval_seconds).toLowerCase()}`;
    }, [propertyQuery.data?.schedule_interval_seconds]);
    const persistedRetrySummary = useMemo(() => {
        return retryMaxAttempts <= 1
            ? "Retries are disabled for failed runs."
            : `Retry on failure up to ${retryMaxAttempts} attempts with ${retryBackoffMillis}ms between attempts.`;
    }, [retryBackoffMillis, retryMaxAttempts]);
    const automationStatus = useMemo(() => {
        return scheduleStatusLabel(propertyQuery.data?.schedule_interval_seconds, latestAutomationRun);
    }, [latestAutomationRun, propertyQuery.data?.schedule_interval_seconds]);
    const automationStatusTone: "danger" | "neutral" | "success" | "warning" = latestAutomationRun?.status === "running"
        ? "warning"
        : latestAutomationRun?.status === "failed"
            ? "danger"
            : propertyQuery.data?.schedule_interval_seconds !== undefined && propertyQuery.data.schedule_interval_seconds > 0
                ? "success"
                : "neutral";

    const editorContent = (
        <PageStack>
            <PageCard
                action={!isCreateMode ? <Button as={Link} to={"/properties"} variant={"secondary"}>{"Back to properties"}</Button> : undefined}
                description={isCreateMode ? "Add a property URL and define exactly how often automated runs should happen." : "Update the property URL, template assignment, schedule, and retry behavior."}
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
                    <Field
                        error={scheduleIntervalError}
                        fullWidth
                        hint={scheduleIntervalError === undefined ? "Runs every X minutes/hours using the saved backend schedule." : undefined}
                        label={"Run interval"}
                    >
                        <div style={{ display: "grid", gap: "0.75rem" }}>
                            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "minmax(0, 1fr) 11rem" }}>
                                <Input
                                    id={"prop-schedule-value"}
                                    invalid={scheduleIntervalError !== undefined}
                                    min={1}
                                    onChange={(event) => { setScheduleIntervalValue(event.target.value); }}
                                    placeholder={"15"}
                                    type={"number"}
                                    value={scheduleIntervalValue}
                                />
                                <Select
                                    id={"prop-schedule-unit"}
                                    invalid={scheduleIntervalError !== undefined}
                                    onChange={(event) => { setScheduleIntervalUnit(event.target.value as DurationUnit); }}
                                    value={scheduleIntervalUnit}
                                >
                                    <option value={"seconds"}>{"Seconds"}</option>
                                    <option value={"minutes"}>{"Minutes"}</option>
                                    <option value={"hours"}>{"Hours"}</option>
                                </Select>
                            </div>
                            <ActionGroup>
                                {schedulePresets.map((preset) => {
                                    const presetLabel = formatDurationFromSeconds(durationDraftToSeconds(preset.value, preset.unit) ?? 0);
                                    return (
                                        <Button
                                            key={`${preset.value}-${preset.unit}`}
                                            onClick={() => {
                                                setScheduleIntervalValue(preset.value);
                                                setScheduleIntervalUnit(preset.unit);
                                            }}
                                            size={"small"}
                                            variant={"secondary"}
                                        >
                                            {presetLabel}
                                        </Button>
                                    );
                                })}
                            </ActionGroup>
                        </div>
                    </Field>
                    <div style={{ display: "grid", gap: "0.25rem", gridColumn: "1 / -1" }}>
                        <strong>{"Retry on failure"}</strong>
                        <p className={"muted-copy"}>{"Only failed runs use retry attempts and retry interval. Successful runs wait for the next scheduled execution."}</p>
                    </div>
                    <Field hint={"Retry on failure before the base schedule resumes."} label={"Max attempts"}>
                        <Input id={"prop-retry"} min={1} onChange={(event) => { setRetryMaxAttempts(readNonNegativeNumber(event.target.value, 1)); }} type={"number"} value={retryMaxAttempts} />
                    </Field>
                    <Field error={retryBackoffError} hint={"Retry interval between failed attempts."} label={"Retry interval (ms)"}>
                        <Input
                            id={"prop-backoff"}
                            invalid={retryBackoffError !== undefined}
                            min={MIN_RETRY_BACKOFF_MS}
                            onChange={(event) => { setRetryBackoffMillis(readNonNegativeNumber(event.target.value, 500)); }}
                            type={"number"}
                            value={retryBackoffMillis}
                        />
                    </Field>
                </FormGrid>
                {!isCreateMode && propertyQuery.data !== undefined ? (
                    <KeyValueGrid compact>
                        <KeyValuePair label={"Scheduling"} value={persistedScheduleSummary} />
                        <KeyValuePair label={"Next run"} value={propertyQuery.data.next_run_at === undefined ? "Waiting for save" : formatDateTime(propertyQuery.data.next_run_at)} />
                        <KeyValuePair label={"Last run"} value={propertyQuery.data.last_run_at === undefined ? "No runs yet" : formatDateTime(propertyQuery.data.last_run_at)} />
                        <KeyValuePair label={"Retry policy"} value={persistedRetrySummary} />
                    </KeyValueGrid>
                ) : null}
                {savePropertyMutation.isError ? <ErrorBanner>{"Could not save property. Check the URL and selected source."}</ErrorBanner> : null}
                <ActionGroup>
                    <Button disabled={savePropertyMutation.isPending || propertySaveError !== undefined || url.trim() === ""} onClick={() => { savePropertyMutation.mutate(); }}>
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
                            <KeyValuePair
                                label={"Automation"}
                                value={(
                                    <span className={"status-with-copy"}>
                                        <StatusBadge tone={automationStatusTone} value={automationStatus} />
                                        <CopyButton label={"Copy property URL"} value={propertyQuery.data.url} />
                                    </span>
                                )}
                            />
                            <KeyValuePair label={"Property status"} value={<StatusBadge tone={propertyQuery.data.status === "active" ? "success" : propertyQuery.data.status === "degraded" ? "warning" : propertyQuery.data.status === "inactive" ? "danger" : "neutral"} value={propertyQuery.data.status} />} />
                            <KeyValuePair label={"Source"} value={sourcesQuery.data?.find((source) => source.id === propertyQuery.data?.source_id)?.name ?? "No template"} />
                            <KeyValuePair label={"Runs every"} value={formatDurationFromSeconds(propertyQuery.data.schedule_interval_seconds)} />
                            <KeyValuePair label={"Next run"} value={propertyQuery.data.next_run_at === undefined ? "Not scheduled yet" : formatDateTime(propertyQuery.data.next_run_at)} />
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
                            <Tooltip content={persistedRetrySummary}>
                                <Button disabled={ingestMutation.isPending} onClick={() => { ingestMutation.mutate(); }}>
                                    {ingestMutation.isPending ? "Running..." : "Run now"}
                                </Button>
                            </Tooltip>
                            <Button as={Link} to={`/runs?property_id=${resolvedId}`} variant={"secondary"}>{"View history"}</Button>
                        </ActionGroup>
                    )}
                    description={`${persistedScheduleSummary}. ${persistedRetrySummary}`}
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
                                    {
                                        align: "right",
                                        cell: (item) => (
                                            <RowActions>
                                                <Button as={Link} size={"small"} to={`/properties/${resolvedId}/fields/${encodeURIComponent(item.field)}/analysis`} variant={"ghost"}>
                                                    {"View Analysis"}
                                                </Button>
                                            </RowActions>
                                        ),
                                        header: "Actions",
                                        id: "actions",
                                    },
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

                <PageCard
                    action={(
                        <Button onClick={() => { setTagsOpen(true); }} variant={"secondary"}>{"Edit tags"}</Button>
                    )}
                    description={"Organize properties with tags for filtering and categorization."}
                    title={"Tags"}
                >
                    {propertyTagsQuery.isLoading ? <p className={"muted-copy"}>{"Loading tags..."}</p> : null}
                    {(propertyTagsQuery.data ?? []).length === 0 && !propertyTagsQuery.isLoading ? 
                        <EmptyState message={"No tags assigned. Click 'Edit tags' to add tags."} />
                        : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                {(propertyTagsQuery.data ?? []).map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                            </div>
                        )}
                </PageCard>

                <PageCard description={"Recent automation runs with auto-refresh every 5 seconds."} title={"Automation Runs"}>
                    <DataTable
                        caption={"Property automation runs"}
                        columns={[
                            { cell: (item) => <StatusBadge tone={runStatusTone(item.status)} value={item.status} />, header: "Status", id: "status", width: "8rem" },
                            { cell: (item) => item.trigger_kind, header: "Trigger", id: "trigger", width: "8rem" },
                            { cell: (item) => `${item.attempt_count} / ${item.max_attempts}`, header: "Attempts", id: "attempts", width: "8rem" },
                            { cell: (item) => item.started_at !== undefined ? formatDateTime(item.started_at) : "—", header: "Started", id: "started_at", sortValue: (item) => item.started_at ?? "", width: "11rem" },
                            { cell: (item) => item.finished_at !== undefined ? formatDateTime(item.finished_at) : "—", header: "Finished", id: "finished_at", width: "11rem" },
                            {
                                cell: (item) => {
                                    if (item.error_message === undefined || item.error_message === "") {
                                        return "—";
                                    }

                                    const truncated = item.error_message.length > 50 ? `${item.error_message.slice(0, 50)}...` : item.error_message;
                                    return (
                                        <Tooltip content={item.error_message}>
                                            <span style={{ color: "#dc2626" }}>{truncated}</span>
                                        </Tooltip>
                                    );
                                },
                                header: "Error",
                                id: "error",
                            },
                        ]}
                        compact
                        emptyMessage={"No automation runs recorded yet."}
                        getRowId={(item) => item.id}
                        items={propertyRunsQuery.data ?? []}
                        pageSize={10}
                        rowLabel={(item) => `Run ${item.id}`}
                    />
                </PageCard>

                <PageCard description={"Recent runs stay directly attached to the property for fast scanning."} title={"Recent Snapshots"}>
                    <DataTable
                        caption={"Recent property snapshots"}
                        columns={[
                            { cell: (item) => item.id, header: "Snapshot", id: "id", sortValue: (item) => item.id },
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

                <PageCard
                    action={(
                        <Button onClick={() => { setCreateAlertOpen(true); }} variant={"secondary"}>{"Create alert"}</Button>
                    )}
                    description={"Alerts trigger when new runs meet property-level conditions."}
                    title={"Alerts"}
                >
                    {propertyAlerts.length === 0 ? <EmptyState message={"No alerts are linked to this property yet."} /> : (
                        <ItemList>
                            {propertyAlerts.map((rule) => {
                                return (
                                    <ListRow key={rule.id}>
                                        <ListRowMain>
                                            <div>
                                                <h3 className={"list-row__title"}>{getRuleTypeLabel(rule.rule_type)}</h3>
                                                <p className={"list-row__meta"}>{getRuleTypeLogic(rule.rule_type, rule.threshold_amount)}</p>
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
            <PropertyAlertCreateDialog
                onOpenChange={setCreateAlertOpen}
                open={createAlertOpen}
                propertyId={resolvedId}
                propertyLabel={propertyQuery.data?.label !== undefined && propertyQuery.data.label !== "" ? propertyQuery.data.label : propertyQuery.data?.url ?? "this property"}
            />
            <TagPicker
                onChange={(tagIds) => { updateTagsMutation.mutate(tagIds); }}
                onOpenChange={setTagsOpen}
                open={tagsOpen}
                selectedTagIds={(propertyTagsQuery.data ?? []).map((tag) => tag.id)}
            />
        </>
    );
};
