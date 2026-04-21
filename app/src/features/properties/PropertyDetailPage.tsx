import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageCard } from "@/components/ui/PageCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { readNonNegativeNumber } from "@/lib/forms/number";
import { formatDateTime } from "@/lib/format/date";
import { propertyKeys } from "@/services/properties/properties.keys";
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
import type { FieldSelector } from "@/services/properties/properties.types";

/** Default field rows shown when the config editor opens for a new property. */
const DEFAULT_FIELDS: FieldSelector[] = [
    { name: "price", required: true, selectors: [] },
    { name: "title", required: false, selectors: [] },
    { name: "location", required: false, selectors: [] },
];

/** Mutable editing shape — selector arrays are expressed as newline-separated strings. */
interface FieldRow {
    readonly attribute: string;
    readonly id: string;
    readonly name: string;
    readonly required: boolean;
    readonly selectorsRaw: string;
    readonly transform: string;
}

const fieldRowToSelector = (row: FieldRow): FieldSelector => ({
    attribute: row.attribute.trim() !== "" ? row.attribute.trim() : undefined,
    name: row.name,
    required: row.required,
    selectors: row.selectorsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s !== ""),
    transform: row.transform.trim() !== "" ? row.transform.trim() : undefined,
});

const selectorToFieldRow = (sel: FieldSelector): FieldRow => ({
    attribute: sel.attribute ?? "",
    id: crypto.randomUUID(),
    name: sel.name,
    required: sel.required,
    selectorsRaw: sel.selectors.join("\n"),
    transform: sel.transform ?? "",
});

const defaultFieldRows = (): FieldRow[] => DEFAULT_FIELDS.map(selectorToFieldRow);

const updateRow = (rows: FieldRow[], rowId: string, patch: Partial<FieldRow>): FieldRow[] =>
    rows.map((r) => r.id === rowId ? { ...r, ...patch } : r);

/**
 * Hosts the property detail and property creation route.
 *
 * Renders multiple scrollable sections: URL/label form, extraction config editor,
 * live preview panel, and snapshot history.
 *
 * @returns The property configuration screen.
 */
export const PropertyDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { propertyId } = useParams<{ propertyId: string }>();
    const isCreateMode = propertyId === undefined || propertyId === "new";
    const resolvedId = isCreateMode ? "" : propertyId;

    // ── Section 1 state ────────────────────────────────────────────────────
    const [url, setUrl] = useState("");
    const [label, setLabel] = useState("");
    const [scheduleInterval, setScheduleInterval] = useState(0);
    const [retryMaxAttempts, setRetryMaxAttempts] = useState(1);
    const [retryBackoffMillis, setRetryBackoffMillis] = useState(500);

    // ── Section 2 state ────────────────────────────────────────────────────
    const [fieldRows, setFieldRows] = useState<FieldRow[]>(defaultFieldRows);

    // ── Section 3 preview state ────────────────────────────────────────────
    const [previewValues, setPreviewValues] = useState<Record<string, string> | null>(null);
    const [previewFailures, setPreviewFailures] = useState<string[]>([]);
    const [previewSuccess, setPreviewSuccess] = useState<boolean | null>(null);

    // ── Queries ────────────────────────────────────────────────────────────
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

    // Hydrate form from loaded property.
    useEffect(() => {
        if (propertyQuery.data !== undefined) {
            setUrl(propertyQuery.data.url);
            setLabel(propertyQuery.data.label);
            setScheduleInterval(propertyQuery.data.schedule_interval_seconds ?? 0);
            setRetryMaxAttempts(propertyQuery.data.retry_max_attempts ?? 1);
            setRetryBackoffMillis(propertyQuery.data.retry_backoff_millis ?? 500);
        }
    }, [propertyQuery.data]);

    // Hydrate field rows from loaded config.
    useEffect(() => {
        if (configQuery.data?.fields !== undefined && configQuery.data.fields.length > 0) {
            setFieldRows(configQuery.data.fields.map(selectorToFieldRow));
        }
    }, [configQuery.data]);

    // ── Mutations ──────────────────────────────────────────────────────────
    const savePropMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                label,
                retry_backoff_millis: retryBackoffMillis,
                retry_max_attempts: retryMaxAttempts,
                schedule_interval_seconds: scheduleInterval,
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
            } else {
                void queryClient.invalidateQueries({ queryKey: propertyKeys.detail(resolvedId) });
            }
        },
    });

    const saveConfigMutation = useMutation({
        mutationFn: () => upsertPropertyConfig(resolvedId, fieldRows.map(fieldRowToSelector)),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.config(resolvedId) });
        },
    });

    const previewMutation = useMutation({
        mutationFn: () =>
            previewExtraction({
                fields: fieldRows.map(fieldRowToSelector),
                url,
            }),
        onSuccess(data) {
            setPreviewValues(data.values);
            setPreviewFailures(data.failures ?? []);
            setPreviewSuccess(data.success);
        },
        onError() {
            setPreviewValues(null);
            setPreviewFailures(["Extraction preview failed. Check the URL and selectors."]);
            setPreviewSuccess(false);
        },
    });

    const ingestMutation = useMutation({
        mutationFn: () => ingestProperty(resolvedId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.snapshots(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.detail(resolvedId) });
        },
    });

    const addFieldRow = (): void => {
        setFieldRows((rows) => [
            ...rows,
            { attribute: "", id: crypto.randomUUID(), name: "", required: false, selectorsRaw: "", transform: "" },
        ]);
    };

    const removeFieldRow = (rowId: string): void => {
        setFieldRows((rows) => rows.filter((r) => r.id !== rowId));
    };

    return (
        <div className={"page-stack"}>
            {/* ── Section 1: URL & label ──────────────────────────────────── */}
            <PageCard
                description={
                    isCreateMode
                        ? "Enter the URL of the listing page you want to track."
                        : "Update the label and scheduling settings for this property."
                }
                title={isCreateMode ? "Add Property" : "Property Settings"}
            >
                {propertyQuery.isError ? 
                    <p className={"error-banner"}>{"Could not load property."}</p>
                    : null}

                <div className={"key-value-grid"}>
                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-url"}>
                        {"URL"}
                    </label>
                    <div className={"key-value-grid__value"}>
                        <input
                            className={"field__control"}
                            disabled={!isCreateMode}
                            id={"prop-url"}
                            onChange={(e) => {
                                setUrl(e.target.value);
                            }}
                            placeholder={"https://example.com/listing/123"}
                            type={"url"}
                            value={url}
                        />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-label"}>
                        {"Label"}
                    </label>
                    <div className={"key-value-grid__value"}>
                        <input
                            className={"field__control"}
                            id={"prop-label"}
                            onChange={(e) => {
                                setLabel(e.target.value);
                            }}
                            placeholder={"Optional display name"}
                            type={"text"}
                            value={label}
                        />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-schedule"}>
                        {"Schedule interval (s)"}
                    </label>
                    <div className={"key-value-grid__value"}>
                        <input
                            className={"field__control"}
                            id={"prop-schedule"}
                            min={0}
                            onChange={(e) => {
                                setScheduleInterval(readNonNegativeNumber(e.target.value, 0));
                            }}
                            type={"number"}
                            value={scheduleInterval}
                        />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-retry"}>
                        {"Retry attempts"}
                    </label>
                    <div className={"key-value-grid__value"}>
                        <input
                            className={"field__control"}
                            id={"prop-retry"}
                            min={1}
                            onChange={(e) => {
                                setRetryMaxAttempts(readNonNegativeNumber(e.target.value, 1));
                            }}
                            type={"number"}
                            value={retryMaxAttempts}
                        />
                    </div>

                    <label className={"key-value-grid__label field__label"} htmlFor={"prop-backoff"}>
                        {"Retry backoff (ms)"}
                    </label>
                    <div className={"key-value-grid__value"}>
                        <input
                            className={"field__control"}
                            id={"prop-backoff"}
                            min={0}
                            onChange={(e) => {
                                setRetryBackoffMillis(readNonNegativeNumber(e.target.value, 500));
                            }}
                            type={"number"}
                            value={retryBackoffMillis}
                        />
                    </div>
                </div>

                {savePropMutation.isError ? 
                    <p className={"error-banner"}>{"Could not save property. Check the URL."}</p>
                    : null}

                <div className={"action-group"}>
                    <button
                        className={"button"}
                        disabled={savePropMutation.isPending || url.trim() === ""}
                        onClick={() => {
                            savePropMutation.mutate();
                        }}
                        type={"button"}
                    >
                        {savePropMutation.isPending
                            ? "Saving..."
                            : isCreateMode
                                ? "Create property"
                                : "Save changes"}
                    </button>
                </div>
            </PageCard>

            {/* ── Section 2: Extraction config (only after property is saved) ── */}
            {!isCreateMode ? (
                <PageCard
                    description={"Define CSS selectors for each field you want to extract from the property page."}
                    title={"Extraction Configuration"}
                >
                    {configQuery.isLoading ? <p className={"muted-copy"}>{"Loading config..."}</p> : null}

                    <div className={"item-list"}>
                        {fieldRows.map((row) => (
                            <div className={"list-row"} key={row.id}>
                                <div className={"key-value-grid"}>
                                    <span className={"key-value-grid__label field__label"}>{"Field name"}</span>
                                    <input
                                        className={"key-value-grid__value field__control"}
                                        onChange={(e) => {
                                            setFieldRows((rows) => updateRow(rows, row.id, { name: e.target.value }));
                                        }}
                                        placeholder={"e.g. price"}
                                        type={"text"}
                                        value={row.name}
                                    />

                                    <span className={"key-value-grid__label field__label"}>{"Selectors"}</span>
                                    <textarea
                                        className={"key-value-grid__value field__control"}
                                        onChange={(e) => {
                                            setFieldRows((rows) =>
                                                updateRow(rows, row.id, { selectorsRaw: e.target.value }),
                                            );
                                        }}
                                        placeholder={"One CSS selector per line"}
                                        rows={3}
                                        value={row.selectorsRaw}
                                    />

                                    <span className={"key-value-grid__label field__label"}>{"Attribute"}</span>
                                    <input
                                        className={"key-value-grid__value field__control"}
                                        onChange={(e) => {
                                            setFieldRows((rows) =>
                                                updateRow(rows, row.id, { attribute: e.target.value }),
                                            );
                                        }}
                                        placeholder={"Optional, e.g. data-price"}
                                        type={"text"}
                                        value={row.attribute}
                                    />

                                    <span className={"key-value-grid__label field__label"}>{"Transform"}</span>
                                    <input
                                        className={"key-value-grid__value field__control"}
                                        onChange={(e) => {
                                            setFieldRows((rows) =>
                                                updateRow(rows, row.id, { transform: e.target.value }),
                                            );
                                        }}
                                        placeholder={"Optional: trim, number"}
                                        type={"text"}
                                        value={row.transform}
                                    />

                                    <span className={"key-value-grid__label field__label"}>{"Required"}</span>
                                    <div className={"key-value-grid__value"}>
                                        <input
                                            checked={row.required}
                                            onChange={(e) => {
                                                setFieldRows((rows) =>
                                                    updateRow(rows, row.id, { required: e.target.checked }),
                                                );
                                            }}
                                            type={"checkbox"}
                                        />
                                    </div>
                                </div>

                                <div className={"action-group"}>
                                    <button
                                        className={"button button--secondary"}
                                        onClick={() => {
                                            removeFieldRow(row.id);
                                        }}
                                        type={"button"}
                                    >
                                        {"Remove field"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {fieldRows.length === 0 ? 
                        <EmptyState message={"No fields defined yet. Add a field to start extracting data."} />
                        : null}

                    {saveConfigMutation.isError ? 
                        <p className={"error-banner"}>{"Could not save configuration."}</p>
                        : null}

                    <div className={"action-group"}>
                        <button className={"button button--secondary"} onClick={addFieldRow} type={"button"}>
                            {"Add field"}
                        </button>
                        <button
                            className={"button"}
                            disabled={saveConfigMutation.isPending || fieldRows.length === 0}
                            onClick={() => {
                                saveConfigMutation.mutate();
                            }}
                            type={"button"}
                        >
                            {saveConfigMutation.isPending ? "Saving..." : "Save configuration"}
                        </button>
                    </div>
                </PageCard>
            ) : null}

            {/* ── Section 3: Preview (only when we have a saved property and fields) ── */}
            {!isCreateMode && fieldRows.length > 0 ? (
                <PageCard
                    description={"Fetch the property page and apply the current selectors to see what values will be extracted."}
                    title={"Extraction Preview"}
                >
                    {previewMutation.isError ? 
                        <p className={"error-banner"}>{"Preview failed. Check the URL and selector definitions."}</p>
                        : null}

                    {previewSuccess !== null ? (
                        <StatusBadge
                            tone={previewSuccess ? "success" : "warning"}
                            value={previewSuccess ? "All selectors matched" : "Some selectors failed"}
                        />
                    ) : null}

                    {previewValues !== null && Object.keys(previewValues).length > 0 ? (
                        <div className={"key-value-grid"}>
                            {Object.entries(previewValues).flatMap(([key, value]) => [
                                <span className={"key-value-grid__label"} key={`${key}-label`}>
                                    {key}
                                </span>,
                                <span className={"key-value-grid__value"} key={`${key}-value`}>
                                    {value}
                                </span>,
                            ])}
                        </div>
                    ) : null}

                    {previewFailures.length > 0 ? (
                        <ul>
                            {previewFailures.map((f) => (
                                <li className={"error-banner"} key={f}>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    <div className={"action-group"}>
                        <button
                            className={"button"}
                            disabled={previewMutation.isPending || url.trim() === ""}
                            onClick={() => {
                                previewMutation.mutate();
                            }}
                            type={"button"}
                        >
                            {previewMutation.isPending ? "Running preview..." : "Run preview"}
                        </button>
                        <button
                            className={"button button--secondary"}
                            disabled={ingestMutation.isPending}
                            onClick={() => {
                                ingestMutation.mutate();
                            }}
                            type={"button"}
                        >
                            {ingestMutation.isPending ? "Ingesting..." : "Ingest now"}
                        </button>
                    </div>
                </PageCard>
            ) : null}

            {/* ── Section 4: Snapshot history ─────────────────────────────── */}
            {!isCreateMode ? (
                <PageCard
                    description={"The most recent extraction results for this property."}
                    title={"Snapshot History"}
                >
                    {snapshotsQuery.isLoading ? <p className={"muted-copy"}>{"Loading snapshots..."}</p> : null}
                    {snapshotsQuery.isError ? 
                        <p className={"error-banner"}>{"Could not load snapshots."}</p>
                        : null}
                    {snapshotsQuery.isSuccess && snapshotsQuery.data.length === 0 ? 
                        <EmptyState message={"No snapshots recorded yet. Run an ingest to capture the first snapshot."} />
                        : null}
                    {snapshotsQuery.data !== undefined && snapshotsQuery.data.length > 0 ? (
                        <div className={"item-list"}>
                            {snapshotsQuery.data.map((snap) => (
                                <article className={"list-row"} key={snap.id}>
                                    <div className={"list-row__main"}>
                                        <div>
                                            <p className={"list-row__meta"}>{formatDateTime(snap.observed_at)}</p>
                                            <div className={"key-value-grid"}>
                                                {Object.entries(snap.values).flatMap(([k, v]) => [
                                                    <span className={"key-value-grid__label"} key={`${snap.id}-${k}-l`}>
                                                        {k}
                                                    </span>,
                                                    <span className={"key-value-grid__value"} key={`${snap.id}-${k}-v`}>
                                                        {v}
                                                        {snap.change_flags?.[k] === true ? <StatusBadge tone={"warning"} value={"changed"} /> : null}
                                                    </span>,
                                                ])}
                                            </div>
                                        </div>
                                        <StatusBadge
                                            tone={snap.is_valid ? "success" : "danger"}
                                            value={snap.is_valid ? "valid" : "invalid"}
                                        />
                                    </div>
                                    {snap.error_message !== undefined && snap.error_message !== "" ? 
                                        <p className={"list-row__footer error-banner"}>{snap.error_message}</p>
                                        : null}
                                </article>
                            ))}
                        </div>
                    ) : null}
                </PageCard>
            ) : null}
        </div>
    );
};
