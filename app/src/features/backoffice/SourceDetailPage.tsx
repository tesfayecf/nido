import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageCard } from "@/components/ui/PageCard";
import { applySourcePreset, DEFAULT_SOURCE_PRESET_ID, getSourcePreset, SOURCE_KIND_OPTIONS, SOURCE_PRESETS, type SourcePresetId } from "@/features/backoffice/sourcePresets";
import { readNonNegativeNumber } from "@/lib/forms/number";
import { formatDateTime } from "@/lib/format/date";
import { ingestSource } from "@/services/backoffice-runs/runs.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { getSource, upsertSource } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";

/**
 * Hosts the source detail and source creation route.
 *
 * @returns The placeholder source detail screen.
 */
export const SourceDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { sourceId } = useParams();
    const isCreateMode = sourceId === undefined;
    const sourceQuery = useQuery({
        enabled: sourceId !== undefined,
        queryFn: () => {
            return getSource(sourceId ?? "");
        },
        queryKey: sourceKeys.detail(sourceId ?? "new"),
    });
    const [formState, setFormState] = useState<Source>(createCreateSource);
    const [selectedPresetId, setSelectedPresetId] = useState<SourcePresetId>(DEFAULT_SOURCE_PRESET_ID);
    const kindOptions = Array.from(new Set([...SOURCE_KIND_OPTIONS, formState.kind].filter((value) => value !== "")));
    const saveMutation = useMutation({
        mutationFn: upsertSource,
        onSuccess(savedSource) {
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
            void queryClient.invalidateQueries({ queryKey: sourceKeys.detail(savedSource.id) });
            void navigate(`/backoffice/sources/${savedSource.id}`);
        },
    });
    const ingestMutation = useMutation({
        mutationFn: ({ force, nextSourceId }: { force: boolean; nextSourceId: string; }) => {
            return ingestSource(nextSourceId, force);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: ["backoffice", "runs"] });
            void queryClient.invalidateQueries({ queryKey: sourceKeys.list() });
        },
    });

    useEffect(() => {
        if (isCreateMode) {
            setSelectedPresetId(DEFAULT_SOURCE_PRESET_ID);
            setFormState(createCreateSource());
            return;
        }

        if (sourceQuery.data !== undefined) {
            setFormState(sourceQuery.data);
        }
    }, [isCreateMode, sourceQuery.data]);

    const selectedPreset = getSourcePreset(selectedPresetId);

    return (
        <div className={"page-stack"}>
            <PageCard
                action={
                    <div className={"action-group"}>
                        <Link className={"button button--secondary"} to={"/backoffice/sources"}>{"Back to sources"}</Link>
                        {!isCreateMode ? (
                            <button
                                className={"button button--secondary"}
                                disabled={ingestMutation.isPending}
                                onClick={() => {
                                    ingestMutation.mutate({ force: false, nextSourceId: formState.id });
                                }}
                                type={"button"}
                            >
                                {"Ingest now"}
                            </button>
                        ) : null}
                    </div>
                }
                description={"The backend upserts the full source payload through a single POST route, so this editor keeps the source model explicit."}
                title={isCreateMode ? "Register Source" : `Source ${formState.name}`}
            >
                {sourceQuery.isLoading ? <p className={"muted-copy"}>{"Loading source..."}</p> : null}
                {sourceQuery.isError ? <p className={"error-banner"}>{"Could not load the selected source."}</p> : null}

                <form
                    className={"form-grid form-grid--two-column"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        saveMutation.mutate(formState);
                    }}
                >
                    {isCreateMode ? (
                        <div className={"field field--full-width"}>
                            <label className={"field__label"} htmlFor={"source-preset"}>{"Preset"}</label>
                            <select
                                aria-describedby={"source-preset-hint"}
                                className={"field__control"}
                                id={"source-preset"}
                                onChange={(event) => {
                                    const nextPresetId = event.target.value as SourcePresetId;
                                    setSelectedPresetId(nextPresetId);
                                    setFormState((previous) => applySourcePreset(previous, nextPresetId));
                                }}
                                value={selectedPresetId}
                            >
                                {SOURCE_PRESETS.map((preset) => {
                                    return <option key={preset.id} value={preset.id}>{preset.label}</option>;
                                })}
                            </select>
                            <p className={"field__hint"} id={"source-preset-hint"}>
                                {selectedPreset.description}{" "}
                                {"Selecting a preset updates kind, browser rendering, and starter config while leaving id, name, and endpoint URL editable."}
                            </p>
                        </div>
                    ) : null}

                    <label className={"field"}>
                        <span className={"field__label"}>{"Id"}</span>
                        <input
                            className={"field__control"}
                            disabled={!isCreateMode}
                            onChange={(event) => {
                                setFormState((previous) => ({ ...previous, id: event.target.value }));
                            }}
                            value={formState.id}
                        />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Name"}</span>
                        <input
                            className={"field__control"}
                            onChange={(event) => {
                                setFormState((previous) => ({ ...previous, name: event.target.value }));
                            }}
                            value={formState.name}
                        />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Kind"}</span>
                        <select
                            className={"field__control"}
                            onChange={(event) => {
                                setFormState((previous) => ({ ...previous, kind: event.target.value }));
                            }}
                            value={formState.kind}
                        >
                            {kindOptions.map((kind) => {
                                return <option key={kind} value={kind}>{kind}</option>;
                            })}
                        </select>
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Endpoint URL"}</span>
                        <input
                            className={"field__control"}
                            onChange={(event) => {
                                setFormState((previous) => ({ ...previous, endpoint_url: event.target.value }));
                            }}
                            value={formState.endpoint_url}
                        />
                    </label>

                    <label className={"field field--checkbox"}>
                        <input
                            checked={formState.active}
                            onChange={(event) => {
                                setFormState((previous) => ({ ...previous, active: event.target.checked }));
                            }}
                            type={"checkbox"}
                        />
                        <span className={"field__label"}>{"Active"}</span>
                    </label>

                    <label className={"field field--checkbox"}>
                        <input
                            checked={formState.browser_enabled}
                            onChange={(event) => {
                                setFormState((previous) => ({ ...previous, browser_enabled: event.target.checked }));
                            }}
                            type={"checkbox"}
                        />
                        <span className={"field__label"}>{"Browser enabled"}</span>
                    </label>

                    <NumberField label={"Rate-limit window seconds"} onValueChange={(value) => { setFormState((previous) => ({ ...previous, rate_limit_window_seconds: value })); }} value={formState.rate_limit_window_seconds ?? 0} />
                    <NumberField label={"Rate-limit max requests"} onValueChange={(value) => { setFormState((previous) => ({ ...previous, rate_limit_max_requests: value })); }} value={formState.rate_limit_max_requests ?? 0} />
                    <NumberField label={"Retry max attempts"} onValueChange={(value) => { setFormState((previous) => ({ ...previous, retry_max_attempts: value })); }} value={formState.retry_max_attempts ?? 1} />
                    <NumberField label={"Retry backoff millis"} onValueChange={(value) => { setFormState((previous) => ({ ...previous, retry_backoff_millis: value })); }} value={formState.retry_backoff_millis ?? 500} />
                    <NumberField label={"Schedule interval seconds"} onValueChange={(value) => { setFormState((previous) => ({ ...previous, schedule_interval_seconds: value })); }} value={formState.schedule_interval_seconds ?? 0} />
                    <NumberField label={"Freshness window seconds"} onValueChange={(value) => { setFormState((previous) => ({ ...previous, freshness_window_seconds: value })); }} value={formState.freshness_window_seconds ?? 0} />

                    <label className={"field field--full-width"}>
                        <span className={"field__label"}>{"Config JSON"}</span>
                        <textarea
                            className={"field__control field__control--textarea"}
                            onChange={(event) => {
                                setFormState((previous) => ({ ...previous, config_json: event.target.value }));
                            }}
                            rows={8}
                            value={formState.config_json ?? "{}"}
                        />
                    </label>

                    <div className={"field field--actions field--full-width"}>
                        <button className={"button"} disabled={saveMutation.isPending} type={"submit"}>
                            {saveMutation.isPending ? "Saving..." : isCreateMode ? "Create source" : "Save source"}
                        </button>
                    </div>
                </form>
            </PageCard>

            {!isCreateMode && sourceQuery.data !== undefined ? (
                <PageCard description={"Timestamps come directly from the backend source record."} title={"Runtime Metadata"}>
                    <div className={"key-value-grid"}>
                        <div>
                            <span className={"key-value-grid__label"}>{"Created at"}</span>
                            <strong className={"key-value-grid__value"}>{sourceQuery.data.created_at === undefined ? "—" : formatDateTime(sourceQuery.data.created_at)}</strong>
                        </div>
                        <div>
                            <span className={"key-value-grid__label"}>{"Updated at"}</span>
                            <strong className={"key-value-grid__value"}>{sourceQuery.data.updated_at === undefined ? "—" : formatDateTime(sourceQuery.data.updated_at)}</strong>
                        </div>
                        <div>
                            <span className={"key-value-grid__label"}>{"Last run"}</span>
                            <strong className={"key-value-grid__value"}>{sourceQuery.data.last_run_at === undefined ? "—" : formatDateTime(sourceQuery.data.last_run_at)}</strong>
                        </div>
                        <div>
                            <span className={"key-value-grid__label"}>{"Next run"}</span>
                            <strong className={"key-value-grid__value"}>{sourceQuery.data.next_run_at === undefined ? "—" : formatDateTime(sourceQuery.data.next_run_at)}</strong>
                        </div>
                    </div>
                </PageCard>
            ) : null}
        </div>
    );
};

interface NumberFieldProps {
    readonly label: string;
    readonly onValueChange: (value: number) => void;
    readonly value: number;
}

const NumberField = ({ label, onValueChange, value }: NumberFieldProps): JSX.Element => {
    return (
        <label className={"field"}>
            <span className={"field__label"}>{label}</span>
            <input
                className={"field__control"}
                min={0}
                onChange={(event) => {
                    onValueChange(readNonNegativeNumber(event.target.value, 0));
                }}
                step={1}
                type={"number"}
                value={value}
            />
        </label>
    );
};

const createCreateSource = (): Source => {
    return applySourcePreset(createEmptySource(), DEFAULT_SOURCE_PRESET_ID);
};

const createEmptySource = (): Source => {
    return {
        active: true,
        browser_enabled: false,
        config_json: "{}",
        endpoint_url: "",
        freshness_window_seconds: 0,
        id: "",
        kind: "http-json-feed",
        name: "",
        rate_limit_max_requests: 0,
        rate_limit_window_seconds: 0,
        retry_backoff_millis: 500,
        retry_max_attempts: 1,
        schedule_interval_seconds: 0,
    };
};