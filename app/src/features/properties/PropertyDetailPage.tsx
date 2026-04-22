import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
            if (isCreateMode) {
                void navigate(`/properties/${data.id}`, { replace: true });
                return;
            }

            void queryClient.invalidateQueries({ queryKey: propertyKeys.detail(resolvedId) });
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

    const latestSnapshot = snapshotsQuery.data?.[0];
    const propertyAlerts = useMemo(() => {
        return (alertsQuery.data ?? []).filter((rule) => rule.property_id === resolvedId);
    }, [alertsQuery.data, resolvedId]);
    const isBookmarked = (bookmarksQuery.data ?? []).some((item) => item.property_id === resolvedId);
    const validationMessages = useMemo(() => validateSelectorDrafts(fieldRows), [fieldRows]);

    return (
        <div className={"page-stack"}>
            <PageCard
                action={!isCreateMode ? <Link className={"button button--secondary"} to={"/properties"}>{"Back to properties"}</Link> : undefined}
                description={isCreateMode ? "Add a property URL and optionally assign a reusable source template." : "Update the property URL, template assignment, and run cadence."}
                title={isCreateMode ? "Add Property" : "Property Settings"}
            >
                {propertyQuery.isError ? <p className={"error-banner"}>{"Could not load property."}</p> : null}
                <div className={"key-value-grid"}>
                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-url"}>{"URL"}</label>
                    <div className={"key-value-grid__value"}>
                        <input className={"field__control"} id={"prop-url"} onChange={(event) => { setUrl(event.target.value); }} placeholder={"https://example.com/property/123"} type={"url"} value={url} />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-label"}>{"Label"}</label>
                    <div className={"key-value-grid__value"}>
                        <input className={"field__control"} id={"prop-label"} onChange={(event) => { setLabel(event.target.value); }} placeholder={"Optional display name"} type={"text"} value={label} />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-source"}>{"Source template"}</label>
                    <div className={"key-value-grid__value"}>
                        <select className={"field__control"} id={"prop-source"} onChange={(event) => { setSourceId(event.target.value); }} value={sourceId}>
                            <option value={""}>{"No template"}</option>
                            {(sourcesQuery.data ?? []).map((source) => {
                                return <option key={source.id} value={source.id}>{source.name}</option>;
                            })}
                        </select>
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-schedule"}>{"Schedule interval (s)"}</label>
                    <div className={"key-value-grid__value"}>
                        <input className={"field__control"} id={"prop-schedule"} min={0} onChange={(event) => { setScheduleInterval(readNonNegativeNumber(event.target.value, 0)); }} type={"number"} value={scheduleInterval} />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-retry"}>{"Retry attempts"}</label>
                    <div className={"key-value-grid__value"}>
                        <input className={"field__control"} id={"prop-retry"} min={1} onChange={(event) => { setRetryMaxAttempts(readNonNegativeNumber(event.target.value, 1)); }} type={"number"} value={retryMaxAttempts} />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-backoff"}>{"Retry backoff (ms)"}</label>
                    <div className={"key-value-grid__value"}>
                        <input className={"field__control"} id={"prop-backoff"} min={0} onChange={(event) => { setRetryBackoffMillis(readNonNegativeNumber(event.target.value, 500)); }} type={"number"} value={retryBackoffMillis} />
                    </div>
                </div>
                {savePropertyMutation.isError ? <p className={"error-banner"}>{"Could not save property. Check the URL and selected source."}</p> : null}
                <div className={"action-group"}>
                    <button className={"button"} disabled={savePropertyMutation.isPending || url.trim() === ""} onClick={() => { savePropertyMutation.mutate(); }} type={"button"}>
                        {savePropertyMutation.isPending ? "Saving..." : isCreateMode ? "Create property" : "Save changes"}
                    </button>
                    {!isCreateMode ? (
                        <button className={"button button--secondary"} disabled={bookmarkMutation.isPending} onClick={() => { bookmarkMutation.mutate(); }} type={"button"}>
                            {isBookmarked ? "Remove bookmark" : "Bookmark"}
                        </button>
                    ) : null}
                </div>
            </PageCard>

            {!isCreateMode ? (
                <PageCard description={"Edit the selectors that this property should use after inheriting from its source template."} title={"Extraction Configuration"}>
                    <SelectorBuilder fields={fieldRows} onChange={setFieldRows} previewByFieldName={previewMap} />
                    {fieldRows.length === 0 ? <EmptyState message={"No fields defined yet. Add a field to start extracting data."} /> : null}
                    <div className={"action-group"}>
                        <button className={"button button--secondary"} onClick={() => { setFieldRows((rows) => [...rows, createEmptySelectorDraft()]); }} type={"button"}>{"Add field"}</button>
                        <button className={"button button--secondary"} disabled={previewMutation.isPending || url.trim() === "" || validationMessages.length > 0} onClick={() => { previewMutation.mutate(); }} type={"button"}>{previewMutation.isPending ? "Previewing..." : "Preview extraction"}</button>
                        <button className={"button"} disabled={saveConfigMutation.isPending || validationMessages.length > 0} onClick={() => { saveConfigMutation.mutate(); }} type={"button"}>{saveConfigMutation.isPending ? "Saving..." : "Save configuration"}</button>
                    </div>
                    {validationMessages.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {validationMessages.map((message) => <p className={"error-banner"} key={message}>{message}</p>)}
                        </div>
                    ) : null}
                    {saveConfigMutation.isError ? <p className={"error-banner"}>{"Could not save configuration."}</p> : null}
                    {previewFailures.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {previewFailures.map((failure) => <p className={"error-banner"} key={failure}>{failure}</p>)}
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

            {!isCreateMode ? (
                <PageCard description={"The latest successful or failed run becomes the current property snapshot."} title={"Current Snapshot"}>
                    {latestSnapshot === undefined ? <EmptyState message={"No runs have been recorded for this property yet."} /> : (
                        <>
                            <div className={"key-value-grid"}>
                                <div>
                                    <span className={"key-value-grid__label"}>{"Status"}</span>
                                    <strong className={"key-value-grid__value"}><StatusBadge tone={latestSnapshot.is_valid ? "success" : "warning"} value={latestSnapshot.is_valid ? "valid" : "invalid"} /></strong>
                                </div>
                                <div>
                                    <span className={"key-value-grid__label"}>{"Observed at"}</span>
                                    <strong className={"key-value-grid__value"}>{formatDateTime(latestSnapshot.observed_at)}</strong>
                                </div>
                            </div>
                            {latestSnapshot.error_message !== undefined && latestSnapshot.error_message !== "" ? <p className={"error-banner"}>{latestSnapshot.error_message}</p> : null}
                            <pre className={"preformatted"}>{JSON.stringify(latestSnapshot.values, null, 2)}</pre>
                            <div className={"action-group"}>
                                <button className={"button"} disabled={ingestMutation.isPending} onClick={() => { ingestMutation.mutate(); }} type={"button"}>{ingestMutation.isPending ? "Running..." : "Run now"}</button>
                                <Link className={"button button--secondary"} to={`/runs?property_id=${resolvedId}`}>{"View full history"}</Link>
                            </div>
                        </>
                    )}
                </PageCard>
            ) : null}

            {!isCreateMode ? (
                <PageCard description={"Alerts trigger when new runs meet property-level conditions."} title={"Alerts"}>
                    {propertyAlerts.length === 0 ? <EmptyState message={"No alerts are linked to this property yet."} /> : (
                        <div className={"item-list"}>
                            {propertyAlerts.map((rule) => {
                                return (
                                    <article className={"list-row"} key={rule.id}>
                                        <div className={"list-row__main"}>
                                            <div>
                                                <h3 className={"list-row__title"}>{rule.rule_type}</h3>
                                                <p className={"list-row__meta"}>{rule.threshold_amount === undefined ? "No threshold" : `Threshold ${rule.threshold_amount}`}</p>
                                            </div>
                                            <strong className={"list-row__price"}>{rule.enabled ? "Active" : "Inactive"}</strong>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </PageCard>
            ) : null}
        </div>
    );
};
