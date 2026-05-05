/**
 * File: app/src/features/analytics/AnalyticsPage.tsx
 *
 * Purpose:
 * Implements the analytics feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, react, @tanstack/react-query, react-router-dom, @/features/analytics/AnalyticsChart, @/components/ui/AsyncContent, @/components/ui/Button, @/components/ui/EmptyState; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-router-dom
 * - @/features/analytics/AnalyticsChart
 * - @/components/ui/AsyncContent
 * - @/components/ui/Button
 * - @/components/ui/EmptyState
 * - @/components/ui/Field
 * - @/components/ui/Input
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
 * - /app/docs/features/analytics.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AnalyticsChart } from "@/features/analytics/AnalyticsChart";
import {
    buildAnalyticsFieldOptions,
    buildAnalyticsSummary,
    buildGroupedAnalytics,
    buildHistogramData,
    buildScatterAnalytics,
    filterAnalyticsRecords,
    formatMetricValue,
    metricLabel,
    parseNumeric,
    type AnalyticsAggregateDatum,
    type AnalyticsChartType,
    type AnalyticsFieldOption,
    type AnalyticsFilterDraft,
    type AnalyticsMetric,
    type AnalyticsScatterDatum,
} from "@/features/analytics/analytics.utils";
import { AsyncContent } from "@/components/ui/AsyncContent";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { formatDateTime } from "@/lib/format/date";
import { analyticsKeys } from "@/services/analytics/analytics.keys";
import { listAnalyticsDataset } from "@/services/analytics/analytics.service";
import type { AnalyticsRecord } from "@/services/analytics/analytics.types";
import { fieldKeys } from "@/services/fields/fields.keys";
import { listFields } from "@/services/fields/fields.service";

const CHART_OPTIONS: readonly { readonly label: string; readonly value: AnalyticsChartType; }[] = [
    { label: "Histogram", value: "histogram" },
    { label: "Vertical bar", value: "bar" },
    { label: "Horizontal bar", value: "bar-horizontal" },
    { label: "Line", value: "line" },
    { label: "Scatter", value: "scatter" },
];

const METRIC_OPTIONS: readonly { readonly label: string; readonly value: AnalyticsMetric; }[] = [
    { label: "Average", value: "average" },
    { label: "Median", value: "median" },
    { label: "Minimum", value: "min" },
    { label: "Maximum", value: "max" },
    { label: "Count", value: "count" },
];

const createFilter = (fieldName = ""): AnalyticsFilterDraft => ({
    field_name: fieldName,
    id: Math.random().toString(36).slice(2, 10),
    max: "",
    min: "",
    operator: "between",
    value: "",
});

/**
 * Purpose: Renders the AnalyticsPage UI boundary documented for app/src/features/analytics/AnalyticsPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const AnalyticsPage = (): JSX.Element => {
    const [chartType, setChartType] = useState<AnalyticsChartType>("histogram");
    const [measureFieldName, setMeasureFieldName] = useState("");
    const [parameterFieldName, setParameterFieldName] = useState("");
    const [segmentFieldName, setSegmentFieldName] = useState("");
    const [metric, setMetric] = useState<AnalyticsMetric>("average");
    const [filters, setFilters] = useState<AnalyticsFilterDraft[]>([]);
    const [hoveredDatumId, setHoveredDatumId] = useState<string | null>(null);
    const [selectedDatumId, setSelectedDatumId] = useState<string | null>(null);

    const fieldsQuery = useQuery({
        queryFn: listFields,
        queryKey: fieldKeys.list(),
    });
    const datasetQuery = useQuery({
        queryFn: listAnalyticsDataset,
        queryKey: analyticsKeys.dataset(),
    });

    const fieldOptions = useMemo(() => buildAnalyticsFieldOptions(fieldsQuery.data ?? []), [fieldsQuery.data]);
    const numericFieldOptions = useMemo(() => fieldOptions.filter((field) => field.data_type === "number"), [fieldOptions]);
    const defaultMeasureFieldName = numericFieldOptions.find((field) => field.name === "price")?.name
        ?? numericFieldOptions[0]?.name
        ?? "";
    const defaultParameterFieldName = numericFieldOptions.find((field) => field.name === "bedrooms")?.name
        ?? numericFieldOptions.find((field) => field.name !== defaultMeasureFieldName)?.name
        ?? fieldOptions.find((field) => field.name === "location")?.name
        ?? "";
    const resolvedMeasureFieldName = measureFieldName !== "" ? measureFieldName : defaultMeasureFieldName;
    const resolvedParameterFieldName = parameterFieldName !== "" ? parameterFieldName : defaultParameterFieldName;
    const resolvedMeasureField = fieldOptions.find((field) => field.name === resolvedMeasureFieldName);

    const distinctValuesByField = useMemo(() => {
        const valuesByField = new Map<string, string[]>();
        for (const field of fieldOptions) {
            if (field.data_type === "number" || field.data_type === "date") {
                continue;
            }

            const items = Array.from(new Set((datasetQuery.data ?? [])
                .map((record) => readRecordValue(record, field.name))
                .filter((value): value is string => value !== undefined && value.trim() !== "")))
                .sort((left, right) => left.localeCompare(right));
            valuesByField.set(field.name, items);
        }

        return valuesByField;
    }, [datasetQuery.data, fieldOptions]);

    const filteredRecords = useMemo(() => {
        return filterAnalyticsRecords(datasetQuery.data ?? [], filters, fieldOptions);
    }, [datasetQuery.data, fieldOptions, filters]);

    const summary = useMemo(() => buildAnalyticsSummary(filteredRecords, resolvedMeasureFieldName), [filteredRecords, resolvedMeasureFieldName]);
    const groupedData = useMemo(() => {
        if (chartType === "histogram" || chartType === "scatter") {
            return [];
        }

        return buildGroupedAnalytics(
            filteredRecords,
            resolvedParameterFieldName,
            resolvedMeasureFieldName,
            metric,
            segmentFieldName,
            fieldOptions,
        );
    }, [chartType, fieldOptions, filteredRecords, metric, resolvedMeasureFieldName, resolvedParameterFieldName, segmentFieldName]);
    const histogramData = useMemo(() => {
        return chartType === "histogram" ? buildHistogramData(filteredRecords, resolvedMeasureFieldName) : [];
    }, [chartType, filteredRecords, resolvedMeasureFieldName]);
    const scatterData = useMemo(() => {
        return chartType === "scatter"
            ? buildScatterAnalytics(filteredRecords, resolvedParameterFieldName, resolvedMeasureFieldName, segmentFieldName)
            : [];
    }, [chartType, filteredRecords, resolvedMeasureFieldName, resolvedParameterFieldName, segmentFieldName]);

    const activeDatum = useMemo(() => {
        const activeId = selectedDatumId ?? hoveredDatumId;
        if (activeId === null) {
            return undefined;
        }

        return groupedData.find((item) => item.id === activeId)
            ?? histogramData.find((item) => item.id === activeId)
            ?? scatterData.find((item) => item.id === activeId);
    }, [groupedData, histogramData, hoveredDatumId, scatterData, selectedDatumId]);

    const selectedRecords = useMemo(() => {
        if (activeDatum === undefined) {
            return filteredRecords.slice(0, 12);
        }

        if ("record" in activeDatum) {
            return [activeDatum.record];
        }

        return activeDatum.records.slice(0, 12);
    }, [activeDatum, filteredRecords]);

    const chartData = chartType === "histogram" ? histogramData : groupedData;
    const chartEmptyMessage = getChartEmptyMessage(chartType, resolvedParameterFieldName);
    const showEmptyChart = (chartType === "histogram" && histogramData.length === 0)
        || (chartType === "scatter" && scatterData.length === 0)
        || ((chartType === "bar" || chartType === "bar-horizontal" || chartType === "line") && chartData.length === 0);
    const chartTypeLabel = CHART_OPTIONS.find((option) => option.value === chartType)?.label ?? chartType;
    const focusLabel = activeDatum === undefined ? "Dataset overview" : activeDatum.label;
    const isLoading = fieldsQuery.isLoading || datasetQuery.isLoading;
    const isError = fieldsQuery.isError || datasetQuery.isError;
    const isEmpty = !isLoading && !isError && (datasetQuery.data?.length ?? 0) === 0;

    return (
        <PageStack>
            <PageCard
                description={"Explore normalized property data with instant filters, grouped metrics, and relationship charts built for rapid single-user analysis."}
                title={"Analytics"}
            >
                <AsyncContent
                    emptyMessage={"Ingest at least one mapped property snapshot to unlock analytics."}
                    errorMessage={"Could not load analytics data."}
                    isEmpty={isEmpty}
                    isError={isError}
                    isLoading={isLoading}
                    loadingMessage={"Loading analytics..."}
                >
                    <div style={{ display: "grid", gap: "1rem" }}>
                        <section aria-label={"Analysis snapshot"} className={"analytics-workbench__snapshot"}>
                            <div className={"analytics-workbench__snapshot-item"}>
                                <span className={"analytics-workbench__snapshot-label"}>{"Primary measure"}</span>
                                <strong className={"analytics-workbench__snapshot-value"}>{resolvedMeasureField?.label ?? "—"}</strong>
                                <span className={"analytics-workbench__snapshot-meta"}>{metricLabel(metric)}</span>
                            </div>
                            <div className={"analytics-workbench__snapshot-item"}>
                                <span className={"analytics-workbench__snapshot-label"}>{"Current lens"}</span>
                                <strong className={"analytics-workbench__snapshot-value"}>{chartTypeLabel}</strong>
                                <span className={"analytics-workbench__snapshot-meta"}>{resolvedParameterFieldName !== "" ? lookupFieldLabel(fieldOptions, resolvedParameterFieldName) : "No grouping field selected."}</span>
                            </div>
                            <div className={"analytics-workbench__snapshot-item"}>
                                <span className={"analytics-workbench__snapshot-label"}>{"Scope"}</span>
                                <strong className={"analytics-workbench__snapshot-value"}>{`${filteredRecords.length} properties`}</strong>
                                <span className={"analytics-workbench__snapshot-meta"}>{filters.length === 0 ? "No filters applied." : `${filters.length} filter${filters.length === 1 ? "" : "s"} applied.`}</span>
                            </div>
                            <div className={"analytics-workbench__snapshot-item"}>
                                <span className={"analytics-workbench__snapshot-label"}>{"Focus"}</span>
                                <strong className={"analytics-workbench__snapshot-value"}>{focusLabel}</strong>
                                <span className={"analytics-workbench__snapshot-meta"}>{activeDatum === undefined ? "Hover or select a mark to inspect specific records." : `${selectedRecords.length} record${selectedRecords.length === 1 ? "" : "s"} contributing.`}</span>
                            </div>
                        </section>

                        <PageCard description={"Key signals for the currently filtered dataset."} title={"Summary"}>
                            <KeyValueGrid compact>
                                <KeyValuePair label={"Properties in scope"} value={summary.total_records.toLocaleString("en")} />
                                <KeyValuePair label={"Measured values"} value={summary.measure_count.toLocaleString("en")} />
                                <KeyValuePair label={"Average"} value={summary.average !== undefined ? formatMetricValue(summary.average, resolvedMeasureField?.unit) : "—"} />
                                <KeyValuePair label={"Median"} value={summary.median !== undefined ? formatMetricValue(summary.median, resolvedMeasureField?.unit) : "—"} />
                                <KeyValuePair label={"Minimum"} value={summary.min !== undefined ? formatMetricValue(summary.min, resolvedMeasureField?.unit) : "—"} />
                                <KeyValuePair label={"Maximum"} value={summary.max !== undefined ? formatMetricValue(summary.max, resolvedMeasureField?.unit) : "—"} />
                            </KeyValueGrid>
                        </PageCard>

                        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 2.2fr) minmax(18rem, 1fr)" }}>
                            <PageCard
                                description={`${metricLabel(metric)} ${resolvedMeasureField?.label ?? "metric"}${chartType === "histogram" ? " distribution" : chartType === "scatter" ? ` against ${lookupFieldLabel(fieldOptions, resolvedParameterFieldName)}` : resolvedParameterFieldName !== "" ? ` by ${lookupFieldLabel(fieldOptions, resolvedParameterFieldName)}` : ""}.`}
                                title={"Visualization"}
                            >
                                {showEmptyChart ? <EmptyState message={chartEmptyMessage} /> : (
                                    <AnalyticsChart
                                        chartType={chartType}
                                        data={chartData}
                                        onHover={setHoveredDatumId}
                                        onSelect={(datumId) => {
                                            setSelectedDatumId((current) => current === datumId ? null : datumId);
                                        }}
                                        scatterData={scatterData}
                                        selectedId={selectedDatumId}
                                    />
                                )}
                            </PageCard>

                            <PageCard description={"Adjust the slice, grouping, and chart without leaving the page."} title={"Controls"}>
                                <div style={{ display: "grid", gap: "1rem" }}>
                                    <Field label={"Chart"}>
                                        <Select onChange={(event) => { setChartType(event.target.value as AnalyticsChartType); setSelectedDatumId(null); setHoveredDatumId(null); }} value={chartType}>
                                            {CHART_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label={"Measure"}>
                                        <Select onChange={(event) => { setMeasureFieldName(event.target.value); setSelectedDatumId(null); }} value={resolvedMeasureFieldName}>
                                            {numericFieldOptions.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label={"Metric"}>
                                        <Select onChange={(event) => { setMetric(event.target.value as AnalyticsMetric); setSelectedDatumId(null); }} value={metric}>
                                            {METRIC_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </Select>
                                    </Field>
                                    {chartType === "scatter" || chartType === "line" || chartType === "bar" || chartType === "bar-horizontal" ? (
                                        <Field label={chartType === "scatter" ? "X-axis" : "Parameter / group"}>
                                            <Select onChange={(event) => { setParameterFieldName(event.target.value); setSelectedDatumId(null); }} value={resolvedParameterFieldName}>
                                                <option value={""}>{"None"}</option>
                                                {fieldOptions.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
                                            </Select>
                                        </Field>
                                    ) : null}
                                    {chartType !== "histogram" ? (
                                        <Field label={"Segment"}>
                                            <Select onChange={(event) => { setSegmentFieldName(event.target.value); setSelectedDatumId(null); }} value={segmentFieldName}>
                                                <option value={""}>{"None"}</option>
                                                {fieldOptions.filter((field) => field.name !== resolvedParameterFieldName).map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
                                            </Select>
                                        </Field>
                                    ) : null}

                                    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                                        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                                            <strong>{"Filters"}</strong>
                                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                                {filters.length > 0 ? (
                                                    <Button
                                                        onClick={() => {
                                                            setFilters([]);
                                                            setSelectedDatumId(null);
                                                            setHoveredDatumId(null);
                                                        }}
                                                        size={"small"}
                                                        variant={"secondary"}
                                                    >
                                                        {"Clear filters"}
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    onClick={() => {
                                                        setFilters((current) => [...current, createFilter(resolvedMeasureFieldName)]);
                                                    }}
                                                    size={"small"}
                                                    variant={"secondary"}
                                                >
                                                    {"Add filter"}
                                                </Button>
                                            </div>
                                        </div>
                                        <div style={{ display: "grid", gap: "0.75rem" }}>
                                            {filters.length === 0 ? <p className={"muted-copy"} style={{ margin: 0 }}>{"No filters applied. Add filters to narrow the active dataset."}</p> : null}
                                            {filters.map((filter) => {
                                                const field = fieldOptions.find((option) => option.name === filter.field_name);
                                                const isRangeField = field?.data_type === "number" || field?.data_type === "date";
                                                const valueOptions = field !== undefined ? distinctValuesByField.get(field.name) ?? [] : [];
                                                return (
                                                    <div key={filter.id} style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", display: "grid", gap: "0.75rem", padding: "0.75rem" }}>
                                                        <Field label={"Field"}>
                                                            <Select onChange={(event) => { updateFilter(setFilters, filter.id, { field_name: event.target.value, max: "", min: "", operator: "between", value: "" }); }} value={filter.field_name}>
                                                                <option value={""}>{"Choose field"}</option>
                                                                {fieldOptions.map((option) => <option key={option.name} value={option.name}>{option.label}</option>)}
                                                            </Select>
                                                        </Field>
                                                        <Field label={"Operator"}>
                                                            <Select onChange={(event) => { updateFilter(setFilters, filter.id, { operator: event.target.value as "between" | "equals" }); }} value={isRangeField ? filter.operator : "equals"}>
                                                                {isRangeField ? <option value={"between"}>{"Between"}</option> : null}
                                                                <option value={"equals"}>{"Equals"}</option>
                                                            </Select>
                                                        </Field>
                                                        {isRangeField && filter.operator === "between" ? (
                                                            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                                                                <Field label={"Minimum"}>
                                                                    <Input onChange={(event) => { updateFilter(setFilters, filter.id, { min: event.target.value }); }} type={field?.data_type === "date" ? "date" : "number"} value={filter.min} />
                                                                </Field>
                                                                <Field label={"Maximum"}>
                                                                    <Input onChange={(event) => { updateFilter(setFilters, filter.id, { max: event.target.value }); }} type={field?.data_type === "date" ? "date" : "number"} value={filter.max} />
                                                                </Field>
                                                            </div>
                                                        ) : (
                                                            <Field label={"Value"}>
                                                                {valueOptions.length > 0 && valueOptions.length <= 16 ? (
                                                                    <Select onChange={(event) => { updateFilter(setFilters, filter.id, { value: event.target.value }); }} value={filter.value}>
                                                                        <option value={""}>{"Choose value"}</option>
                                                                        {valueOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                                                                    </Select>
                                                                ) : (
                                                                    <Input
                                                                        onChange={(event) => { updateFilter(setFilters, filter.id, { value: event.target.value }); }}
                                                                        placeholder={"Exact value"}
                                                                        type={field?.data_type === "date" ? "date" : field?.data_type === "number" ? "number" : "text"}
                                                                        value={filter.value}
                                                                    />
                                                                )}
                                                            </Field>
                                                        )}
                                                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                                            <Button onClick={() => { setFilters((current) => current.filter((item) => item.id !== filter.id)); }} size={"small"} variant={"secondary"}>
                                                                {"Remove"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </PageCard>
                        </div>

                        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)" }}>
                            <PageCard
                                action={activeDatum !== undefined ? (
                                    <Button
                                        onClick={() => {
                                            setSelectedDatumId(null);
                                            setHoveredDatumId(null);
                                        }}
                                        size={"small"}
                                        variant={"secondary"}
                                    >
                                        {"Clear selection"}
                                    </Button>
                                ) : undefined}
                                description={activeDatum === undefined ? "Showing the currently filtered properties." : "Hover or click a mark to inspect the exact contributing properties."}
                                title={activeDatum === undefined ? "Records in scope" : "Selected records"}
                            >
                                {activeDatum !== undefined ? (
                                    <KeyValueGrid compact style={{ marginBottom: "1rem" }}>
                                        <KeyValuePair label={"Selection"} value={"record" in activeDatum ? activeDatum.label : activeDatum.label} />
                                        <KeyValuePair label={"Series"} value={activeDatum.segment} />
                                        <KeyValuePair label={"Contribution"} value={formatActiveDatumValue(activeDatum, resolvedMeasureField?.unit)} />
                                    </KeyValueGrid>
                                ) : null}
                                {selectedRecords.length === 0 ? <EmptyState message={"No properties match the current chart selection."} /> : (
                                    <div style={{ display: "grid", gap: "0.75rem" }}>
                                        {selectedRecords.map((record) => {
                                            const propertyLabel = record.property_label?.trim() !== "" ? record.property_label : record.property_id;
                                            const measureValue = formatRecordField(record, resolvedMeasureFieldName, resolvedMeasureField?.unit);
                                            const parameterLabel = lookupFieldLabel(fieldOptions, resolvedParameterFieldName);
                                            const parameterValue = formatRecordField(record, resolvedParameterFieldName);
                                            return (
                                                <Link key={record.property_id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "inherit", padding: "0.875rem", textDecoration: "none" }} to={`/properties/${record.property_id}`}>
                                                    <strong style={{ display: "block" }}>{propertyLabel}</strong>
                                                    <span className={"muted-copy"} style={{ display: "block", marginTop: "0.25rem" }}>
                                                        {`${resolvedMeasureField?.label ?? "Measure"}: ${measureValue} · ${parameterLabel}: ${parameterValue}`}
                                                    </span>
                                                    <span className={"muted-copy"} style={{ display: "block", marginTop: "0.25rem" }}>{`Observed ${formatDateTime(record.observed_at)}`}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </PageCard>

                            <PageCard description={"Use this quick reference to confirm what the current controls are measuring."} title={"Active analysis"}>
                                <KeyValueGrid compact>
                                    <KeyValuePair label={"Chart"} value={chartTypeLabel} />
                                    <KeyValuePair label={"Measure"} value={resolvedMeasureField?.label ?? "—"} />
                                    <KeyValuePair label={"Metric"} value={metricLabel(metric)} />
                                    <KeyValuePair label={"Parameter"} value={resolvedParameterFieldName !== "" ? lookupFieldLabel(fieldOptions, resolvedParameterFieldName) : "None"} />
                                    <KeyValuePair label={"Segment"} value={segmentFieldName !== "" ? lookupFieldLabel(fieldOptions, segmentFieldName) : "None"} />
                                    <KeyValuePair label={"Filters"} value={filters.length === 0 ? "None" : `${filters.length} active`} />
                                </KeyValueGrid>
                            </PageCard>
                        </div>
                    </div>
                </AsyncContent>
            </PageCard>
        </PageStack>
    );
};

const updateFilter = (
    setFilters: Dispatch<SetStateAction<AnalyticsFilterDraft[]>>,
    filterId: string,
    patch: Partial<AnalyticsFilterDraft>,
): void => {
    setFilters((current) => current.map((filter) => filter.id === filterId ? { ...filter, ...patch } : filter));
};

const lookupFieldLabel = (fieldOptions: AnalyticsFieldOption[], fieldName: string): string => {
    return fieldOptions.find((field) => field.name === fieldName)?.label ?? "None";
};

const readRecordValue = (record: AnalyticsRecord, fieldName: string): string | undefined => {
    switch (fieldName) {
        case "observed_at":
            return record.observed_at;
        case "source_id":
            return record.source_id;
        case "status":
            return record.status;
        default:
            return record.values[fieldName];
    }
};

const formatRecordField = (record: AnalyticsRecord, fieldName: string, unit?: string): string => {
    if (fieldName.trim() === "") {
        return "—";
    }

    const rawValue = readRecordValue(record, fieldName);
    if (rawValue === undefined || rawValue.trim() === "") {
        return "—";
    }

    if (fieldName === "observed_at") {
        return formatDateTime(rawValue);
    }

    const numericValue = parseNumeric(rawValue);
    return numericValue !== undefined ? formatMetricValue(numericValue, unit) : rawValue;
};

const formatActiveDatumValue = (
    datum: AnalyticsAggregateDatum | AnalyticsScatterDatum,
    unit?: string,
): string => {
    if ("record" in datum) {
        return `${formatMetricValue(datum.y, unit)} vs ${formatMetricValue(datum.x)}`;
    }

    return formatMetricValue(datum.value, unit);
};

const getChartEmptyMessage = (chartType: AnalyticsChartType, parameterFieldName: string): string => {
    if (chartType === "scatter") {
        return parameterFieldName === ""
            ? "Choose a numeric X-axis to render the scatter plot."
            : "No numeric points match the current scatter configuration.";
    }

    if (chartType === "line" || chartType === "bar" || chartType === "bar-horizontal") {
        return parameterFieldName === ""
            ? "Choose a parameter or grouping field to render this chart."
            : "No grouped values match the current configuration.";
    }

    return "No measure values are available for the current histogram.";
};
