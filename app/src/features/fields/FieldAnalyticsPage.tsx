/**
 * File: app/src/features/fields/FieldAnalyticsPage.tsx
 *
 * Purpose:
 * Implements the fields feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @tanstack/react-query, react-router-dom, @/components/ui/Button, @/components/ui/EmptyState, @/components/ui/ErrorBanner, @/components/ui/Field, @/components/ui/Input; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-router-dom
 * - @/components/ui/Button
 * - @/components/ui/EmptyState
 * - @/components/ui/ErrorBanner
 * - @/components/ui/Field
 * - @/components/ui/Input
 * - @/components/ui/KeyValueGrid
 * - @/components/ui/PageCard
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
 * - /app/docs/features/fields.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { AnalyticsChart } from "@/features/analytics/AnalyticsChart";
import {
    buildAnalyticsFieldOptions,
    buildGroupedAnalytics,
    buildHistogramData,
    formatMetricValue,
    parseNumeric,
    type AnalyticsAggregateDatum,
    type AnalyticsFieldOption,
} from "@/features/analytics/analytics.utils";
import { analyticsKeys } from "@/services/analytics/analytics.keys";
import { listAnalyticsDataset } from "@/services/analytics/analytics.service";
import type { AnalyticsRecord } from "@/services/analytics/analytics.types";
import { fieldKeys } from "@/services/fields/fields.keys";
import { listFields } from "@/services/fields/fields.service";

interface FieldDatasetSummary {
    readonly available_count: number;
    readonly average?: number;
    readonly max?: number;
    readonly median?: number;
    readonly min?: number;
    readonly missing_count: number;
    readonly total_count: number;
}

const readFieldValue = (record: AnalyticsRecord, fieldName: string): string | undefined => {
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

const buildFieldSummary = (records: AnalyticsRecord[], fieldName: string): FieldDatasetSummary => {
    const values = records
        .map((record) => readFieldValue(record, fieldName))
        .filter((value): value is string => value !== undefined && value.trim() !== "");
    const numericValues = values.map((value) => parseNumeric(value)).filter((value): value is number => value !== undefined).sort((left, right) => left - right);
    const medianIndex = Math.floor(numericValues.length / 2);

    return {
        available_count: values.length,
        average: numericValues.length > 0 ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : undefined,
        max: numericValues[numericValues.length - 1],
        median: numericValues.length === 0
            ? undefined
            : numericValues.length % 2 === 0
                ? ((numericValues[medianIndex - 1] ?? 0) + (numericValues[medianIndex] ?? 0)) / 2
                : numericValues[medianIndex],
        min: numericValues[0],
        missing_count: records.length - values.length,
        total_count: records.length,
    };
};

const buildTrendData = (records: AnalyticsRecord[], fieldName: string, field: AnalyticsFieldOption | undefined): AnalyticsAggregateDatum[] => {
    const byDay = new Map<string, AnalyticsRecord[]>();
    records.forEach((record) => {
        const day = record.observed_at.slice(0, 10);
        const current = byDay.get(day) ?? [];
        byDay.set(day, [...current, record]);
    });

    const groupedRecords = Array.from(byDay.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .flatMap(([, items]) => items);

    if (field === undefined) {
        return buildGroupedAnalytics(groupedRecords, "observed_at", "", "count", "", buildAnalyticsFieldOptions([]));
    }

    if (field?.data_type === "number") {
        return buildGroupedAnalytics(groupedRecords, "observed_at", fieldName, "average", "", [
            ...buildAnalyticsFieldOptions([]),
            { data_type: field.data_type, label: field.label, name: field.name, unit: field.unit },
        ]);
    }

    return buildGroupedAnalytics(groupedRecords, "observed_at", "", "count", "", buildAnalyticsFieldOptions([]));
};

/**
 * Purpose: Renders the FieldAnalyticsPage UI boundary documented for app/src/features/fields/FieldAnalyticsPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const FieldAnalyticsPage = (): JSX.Element => {
    const { fieldName } = useParams<{ fieldName: string; }>();
    const resolvedFieldName = decodeURIComponent(fieldName ?? "");
    const [sourceFilter, setSourceFilter] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const fieldsQuery = useQuery({
        queryFn: listFields,
        queryKey: fieldKeys.list(),
    });
    const datasetQuery = useQuery({
        queryFn: listAnalyticsDataset,
        queryKey: analyticsKeys.dataset(),
    });

    const fieldOptions = useMemo(() => buildAnalyticsFieldOptions(fieldsQuery.data ?? []), [fieldsQuery.data]);
    const selectedField = useMemo(() => fieldOptions.find((field) => field.name === resolvedFieldName), [fieldOptions, resolvedFieldName]);
    const allRecords = datasetQuery.data ?? [];
    const sourceOptions = useMemo(() => {
        return Array.from(new Set(allRecords.map((record) => record.source_id).filter((value): value is string => value !== undefined && value.trim() !== ""))).sort((left, right) => left.localeCompare(right));
    }, [allRecords]);
    const filteredRecords = useMemo(() => {
        return allRecords.filter((record) => {
            if (sourceFilter !== "" && record.source_id !== sourceFilter) {
                return false;
            }

            if (startDate !== "" && record.observed_at.slice(0, 10) < startDate) {
                return false;
            }

            if (endDate !== "" && record.observed_at.slice(0, 10) > endDate) {
                return false;
            }

            return true;
        });
    }, [allRecords, endDate, sourceFilter, startDate]);
    const globalSummary = useMemo(() => buildFieldSummary(allRecords, resolvedFieldName), [allRecords, resolvedFieldName]);
    const filteredSummary = useMemo(() => buildFieldSummary(filteredRecords, resolvedFieldName), [filteredRecords, resolvedFieldName]);
    const distributionData = useMemo(() => {
        if (selectedField?.data_type === "number") {
            return buildHistogramData(filteredRecords, resolvedFieldName);
        }

        return buildGroupedAnalytics(filteredRecords, resolvedFieldName, "", "count", "", fieldOptions);
    }, [fieldOptions, filteredRecords, resolvedFieldName, selectedField?.data_type]);
    const trendData = useMemo(() => buildTrendData(filteredRecords, resolvedFieldName, selectedField), [filteredRecords, resolvedFieldName, selectedField]);
    const chartTitle = selectedField?.data_type === "number" ? "Distribution" : "Value frequency";
    const chartDescription = selectedField?.data_type === "number"
        ? "Histogram across all filtered properties containing this field."
        : "Most common captured values in the filtered dataset.";

    return (
        <PageStack>
            <PageCard
                action={<Button as={Link} to={"/fields"} variant={"secondary"}>{"Back to fields"}</Button>}
                description={`Dedicated analytics for "${selectedField?.label ?? resolvedFieldName}" across every property snapshot that contains this field.`}
                title={selectedField?.label ?? resolvedFieldName}
            >
                {fieldsQuery.isError || datasetQuery.isError ? <ErrorBanner>{"Could not load field analytics."}</ErrorBanner> : null}
                {selectedField === undefined ? <EmptyState message={"This field is not available in the analytics dataset."} /> : (
                    <div style={{ display: "grid", gap: "1rem" }}>
                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                            <Field label={"Source"}>
                                <Select onChange={(event) => { setSourceFilter(event.target.value); }} value={sourceFilter}>
                                    <option value={""}>{"All sources"}</option>
                                    {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                                </Select>
                            </Field>
                            <Field label={"Start date"}>
                                <Input onChange={(event) => { setStartDate(event.target.value); }} type={"date"} value={startDate} />
                            </Field>
                            <Field label={"End date"}>
                                <Input onChange={(event) => { setEndDate(event.target.value); }} type={"date"} value={endDate} />
                            </Field>
                        </div>

                        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                            <PageCard description={"Global benchmark for this field across all records."} title={"Global"}>
                                <SummaryGrid field={selectedField} summary={globalSummary} />
                            </PageCard>
                            <PageCard description={"Active filtered slice compared with the global benchmark."} title={"Filtered"}>
                                <SummaryGrid field={selectedField} summary={filteredSummary} />
                            </PageCard>
                        </div>

                        <PageCard description={"Missing and sparse values stay visible so thin datasets are obvious."} title={"Coverage"}>
                            <KeyValueGrid compact>
                                <KeyValuePair label={"Available values"} value={filteredSummary.available_count.toLocaleString("en")} />
                                <KeyValuePair label={"Missing values"} value={filteredSummary.missing_count.toLocaleString("en")} />
                                <KeyValuePair label={"Coverage"} value={filteredSummary.total_count === 0 ? "0%" : `${Math.round((filteredSummary.available_count / filteredSummary.total_count) * 100)}%`} />
                                <KeyValuePair label={"Data quality"} value={filteredSummary.available_count < 5 ? "Sparse" : "Sufficient"} />
                            </KeyValueGrid>
                        </PageCard>

                        <PageCard description={chartDescription} title={chartTitle}>
                            {distributionData.length === 0 ? <EmptyState message={"No field values match the current filter."} /> : (
                                <AnalyticsChart
                                    chartType={selectedField.data_type === "number" ? "histogram" : "bar-horizontal"}
                                    data={distributionData}
                                    onHover={() => undefined}
                                    onSelect={() => undefined}
                                    scatterData={[]}
                                    selectedId={null}
                                />
                            )}
                        </PageCard>

                        <PageCard description={"Trend over time for the filtered slice."} title={"Trend"}>
                            {trendData.length === 0 ? <EmptyState message={"Not enough time-series data is available for this field."} /> : (
                                <AnalyticsChart
                                    chartType={"line"}
                                    data={trendData}
                                    onHover={() => undefined}
                                    onSelect={() => undefined}
                                    scatterData={[]}
                                    selectedId={null}
                                />
                            )}
                        </PageCard>
                    </div>
                )}
            </PageCard>
        </PageStack>
    );
};

const SummaryGrid = ({ field, summary }: { readonly field: AnalyticsFieldOption; readonly summary: FieldDatasetSummary; }): JSX.Element => {
    return (
        <KeyValueGrid compact>
            <KeyValuePair label={"Records in scope"} value={summary.total_count.toLocaleString("en")} />
            <KeyValuePair label={"Available"} value={summary.available_count.toLocaleString("en")} />
            <KeyValuePair label={"Missing"} value={summary.missing_count.toLocaleString("en")} />
            <KeyValuePair label={"Average"} value={summary.average !== undefined ? formatMetricValue(summary.average, field.unit) : "—"} />
            <KeyValuePair label={"Median"} value={summary.median !== undefined ? formatMetricValue(summary.median, field.unit) : "—"} />
            <KeyValuePair label={"Minimum"} value={summary.min !== undefined ? formatMetricValue(summary.min, field.unit) : "—"} />
            <KeyValuePair label={"Maximum"} value={summary.max !== undefined ? formatMetricValue(summary.max, field.unit) : "—"} />
        </KeyValueGrid>
    );
};
