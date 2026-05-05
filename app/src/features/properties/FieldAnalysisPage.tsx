/**
 * File: app/src/features/properties/FieldAnalysisPage.tsx
 *
 * Purpose:
 * Implements the properties feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @tanstack/react-query, react-chartjs-2, react-router-dom, @/components/ui/Button, @/components/ui/EmptyState, @/components/ui/ErrorBanner, @/components/ui/KeyValueGrid; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-chartjs-2
 * - react-router-dom
 * - @/components/ui/Button
 * - @/components/ui/EmptyState
 * - @/components/ui/ErrorBanner
 * - @/components/ui/KeyValueGrid
 * - @/components/ui/PageCard
 * - @/components/ui/PageStack
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { Bar } from "react-chartjs-2";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { SparklineChart } from "@/components/ui/SparklineChart";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createBaseChartOptions, isChartJsdom, useChartTheme } from "@/components/ui/chartTheme";
import { formatDateTime } from "@/lib/format/date";
import { propertyKeys } from "@/services/properties/properties.keys";
import { getProperty, listPropertySnapshots } from "@/services/properties/properties.service";
import type { PropertySnapshot } from "@/services/properties/properties.types";

interface Entry {
    readonly observedAt: string;
    readonly raw: string;
}

interface NumericEntry extends Entry {
    readonly isInteger: boolean;
    readonly value: number;
}

type FieldKind = "empty" | "mixed" | "numeric" | "text";

const NUMERIC_PATTERN = /^-?\d+(?:[.,]\d+)?$/u;
const NUMERIC_EXTRACT = /-?\d[\d.,]*/u;

const parseNumeric = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (trimmed === "") {
        return undefined;
    }

    const direct = trimmed.replace(/,(?=\d{3}(?!\d))/gu, "").replace(",", ".");
    if (NUMERIC_PATTERN.test(direct.replace(/,/gu, "."))) {
        const parsed = Number.parseFloat(direct);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    const match = NUMERIC_EXTRACT.exec(trimmed);
    if (match === null) {
        return undefined;
    }

    const cleaned = match[0].replace(/,(?=\d{3}(?!\d))/gu, "").replace(",", ".");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const median = (sorted: number[]): number => {
    if (sorted.length === 0) {
        return 0;
    }

    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
    }

    return sorted[mid] ?? 0;
};

const standardDeviation = (values: number[], mean: number): number => {
    if (values.length < 2) {
        return 0;
    }

    const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
};

const formatNumber = (value: number, decimals: number): string => {
    if (!Number.isFinite(value)) {
        return "—";
    }

    return value.toLocaleString("en", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0,
    });
};

interface HistogramBin {
    readonly count: number;
    readonly end: number;
    readonly start: number;
}

const buildHistogram = (values: number[], binCount = 10): HistogramBin[] => {
    if (values.length === 0) {
        return [];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    if (minValue === maxValue) {
        return [{ count: values.length, end: maxValue, start: minValue }];
    }

    const buckets = Math.max(1, Math.min(binCount, values.length));
    const width = (maxValue - minValue) / buckets;
    const bins: HistogramBin[] = Array.from({ length: buckets }, (_, index) => {
        return { count: 0, end: minValue + (width * (index + 1)), start: minValue + (width * index) };
    });

    for (const value of values) {
        let index = Math.floor((value - minValue) / width);
        if (index >= buckets) {
            index = buckets - 1;
        }

        if (index < 0) {
            index = 0;
        }

        const existing = bins[index];
        if (existing !== undefined) {
            bins[index] = { ...existing, count: existing.count + 1 };
        }
    }

    return bins;
};

interface FrequencyEntry {
    readonly count: number;
    readonly value: string;
}

const buildFrequency = (values: string[]): FrequencyEntry[] => {
    const counts = new Map<string, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return Array.from(counts.entries())
        .map(([value, count]) => ({ count, value }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

interface FieldAnalysis {
    readonly entries: Entry[];
    readonly kind: FieldKind;
    readonly numericEntries: NumericEntry[];
    readonly numericRatio: number;
}

const analyzeField = (fieldName: string, snapshots: PropertySnapshot[]): FieldAnalysis => {
    const entries: Entry[] = snapshots
        .slice()
        .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
        .map((snapshot) => ({ observedAt: snapshot.observed_at, raw: snapshot.values?.[fieldName] ?? "" }))
        .filter((entry) => entry.raw !== "");

    if (entries.length === 0) {
        return { entries, kind: "empty", numericEntries: [], numericRatio: 0 };
    }

    const numericEntries: NumericEntry[] = [];
    for (const entry of entries) {
        const value = parseNumeric(entry.raw);
        if (value !== undefined) {
            numericEntries.push({ ...entry, isInteger: Number.isInteger(value), value });
        }
    }

    const numericRatio = numericEntries.length / entries.length;

    let kind: FieldKind;
    if (numericRatio >= 0.9) {
        kind = "numeric";
    } else if (numericRatio <= 0.1) {
        kind = "text";
    } else {
        kind = "mixed";
    }

    return { entries, kind, numericEntries, numericRatio };
};

const LOW_DATA_THRESHOLD = 5;
const HIGH_DATA_THRESHOLD = 50;

interface FieldBarDatum {
    readonly detail?: string;
    readonly label: string;
    readonly value: number;
}

const FieldBarChart = ({ data, horizontal = false, label }: { readonly data: readonly FieldBarDatum[]; readonly horizontal?: boolean; readonly label: string; }): JSX.Element => {
    if (isChartJsdom()) {
        return <div className={"field-analysis__bar-chart"} />;
    }

    const theme = useChartTheme();
    const baseOptions = createBaseChartOptions<"bar">(theme, { hideLegend: true });

    return (
        <div className={"field-analysis__bar-chart"}>
            <Bar
                data={{
                    datasets: [{
                        backgroundColor: `${theme.accent}cc`,
                        borderColor: theme.accent,
                        borderWidth: 1,
                        data: data.map((item) => item.value),
                        label,
                    }],
                    labels: data.map((item) => item.label),
                }}
                options={{
                    ...baseOptions,
                    indexAxis: horizontal ? "y" : "x",
                    plugins: {
                        ...baseOptions.plugins,
                        legend: { display: false },
                        tooltip: {
                            ...baseOptions.plugins?.tooltip,
                            callbacks: {
                                label: (context) => data[context.dataIndex]?.detail ?? `${context.formattedValue}`,
                                title: (items) => data[items[0]?.dataIndex ?? 0]?.label ?? "",
                            },
                        },
                    },
                    scales: horizontal ? {
                        ...baseOptions.scales,
                        y: {
                            ...baseOptions.scales?.y,
                            ticks: {
                                ...baseOptions.scales?.y?.ticks,
                                callback: (_value, index) => {
                                    const current = data[index]?.label ?? "";
                                    return current.length > 28 ? `${current.slice(0, 27)}…` : current;
                                },
                            },
                        },
                    } : baseOptions.scales,
                }}
            />
        </div>
    );
};

const NumericSection = ({ analysis }: { analysis: FieldAnalysis; }): JSX.Element => {
    const { numericEntries } = analysis;
    const values = numericEntries.map((entry) => entry.value);
    const sorted = values.slice().sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, value) => acc + value, 0);
    const mean = count > 0 ? sum / count : 0;
    const minValue = sorted[0] ?? 0;
    const maxValue = sorted[sorted.length - 1] ?? 0;
    const medianValue = median(sorted);
    const hasDecimals = numericEntries.some((entry) => !entry.isInteger);
    const decimals = hasDecimals ? 2 : 0;
    const stdDev = count >= LOW_DATA_THRESHOLD ? standardDeviation(values, mean) : undefined;
    const bins = count >= LOW_DATA_THRESHOLD ? buildHistogram(values, Math.min(10, Math.max(3, Math.round(Math.sqrt(count))))) : [];
    const isHighVolume = count >= HIGH_DATA_THRESHOLD;
    const trendPoints = numericEntries.map((entry) => entry.value);

    return (
        <>
            <PageCard description={"Summary statistics for the captured numeric values."} title={"Key Metrics"}>
                <KeyValueGrid compact>
                    <KeyValuePair label={"Count"} value={count.toLocaleString("en")} />
                    <KeyValuePair label={"Mean"} value={formatNumber(mean, decimals)} />
                    <KeyValuePair label={"Median"} value={formatNumber(medianValue, decimals)} />
                    <KeyValuePair label={"Minimum"} value={formatNumber(minValue, decimals)} />
                    <KeyValuePair label={"Maximum"} value={formatNumber(maxValue, decimals)} />
                    {stdDev !== undefined ? <KeyValuePair label={"Std. deviation"} value={formatNumber(stdDev, Math.max(decimals, 2))} /> : null}
                    <KeyValuePair label={"Precision"} value={hasDecimals ? "Decimal" : "Integer"} />
                    <KeyValuePair label={"Range"} value={formatNumber(maxValue - minValue, decimals)} />
                </KeyValueGrid>
            </PageCard>

            {count >= 2 ? (
                <PageCard description={isHighVolume ? "Overview of how the captured values change across runs." : "Sequence of observed values ordered by run time."} title={"Distribution & Trend"}>
                    <div className={"field-analysis__chart"}>
                        <SparklineChart hero points={trendPoints} />
                    </div>
                    {bins.length > 0 ? (
                        <FieldBarChart
                            data={bins.map((bin) => ({
                                detail: `${bin.count} observations`,
                                label: `${formatNumber(bin.start, decimals)} – ${formatNumber(bin.end, decimals)}`,
                                value: bin.count,
                            }))}
                            label={"Observations"}
                        />
                    ) : null}
                </PageCard>
            ) : null}
        </>
    );
};

const TextSection = ({ analysis }: { analysis: FieldAnalysis; }): JSX.Element => {
    const rawValues = analysis.entries.map((entry) => entry.raw);
    const frequency = useMemo(() => buildFrequency(rawValues), [rawValues]);
    const uniqueCount = frequency.length;
    const total = rawValues.length;
    const isHighVolume = total >= HIGH_DATA_THRESHOLD;
    const topCount = isHighVolume ? 10 : 5;
    const top = frequency.slice(0, topCount);
    const dominantShare = total > 0 && top.length > 0 ? ((top[0]?.count ?? 0) / total) : 0;

    return (
        <>
            <PageCard description={"Counts and variety of the captured text values."} title={"Key Metrics"}>
                <KeyValueGrid compact>
                    <KeyValuePair label={"Entries"} value={total.toLocaleString("en")} />
                    <KeyValuePair label={"Unique values"} value={uniqueCount.toLocaleString("en")} />
                    <KeyValuePair label={"Repeat rate"} value={total === 0 ? "—" : `${Math.round((1 - (uniqueCount / total)) * 100)}%`} />
                    {top.length > 0 && top[0] !== undefined ? <KeyValuePair label={"Most common"} value={top[0].value} /> : null}
                    {top.length > 0 ? <KeyValuePair label={"Dominance"} value={`${Math.round(dominantShare * 100)}%`} /> : null}
                </KeyValueGrid>
            </PageCard>
            {top.length > 0 ? (
                <PageCard description={`Top ${top.length} most frequent value${top.length === 1 ? "" : "s"}.`} title={"Frequency Distribution"}>
                    <FieldBarChart
                        data={top.map((entry) => ({
                            detail: `${entry.count} entries · ${total > 0 ? Math.round((entry.count / total) * 100) : 0}%`,
                            label: entry.value,
                            value: entry.count,
                        }))}
                        horizontal
                        label={"Entries"}
                    />
                </PageCard>
            ) : null}
        </>
    );
};

const RawValuesCard = ({ entries, limit }: { entries: Entry[]; limit: number; }): JSX.Element => {
    const recent = entries.slice().reverse().slice(0, limit);
    return (
        <PageCard
            description={entries.length > limit ? `Showing the most recent ${limit} of ${entries.length} entries.` : "All captured values across runs."}
            title={"Raw Values"}
        >
            {recent.length === 0 ? <EmptyState message={"No raw values to show."} /> : (
                <ol className={"field-analysis__list"}>
                    {recent.map((entry) => (
                        <li className={"field-analysis__list-entry"} key={`${entry.observedAt}-${entry.raw}`}>
                            <span className={"field-analysis__list-time"}>{formatDateTime(entry.observedAt)}</span>
                            <code className={"field-analysis__list-value"}>{entry.raw}</code>
                        </li>
                    ))}
                </ol>
            )}
        </PageCard>
    );
};

/**
 * Purpose: Renders the FieldAnalysisPage UI boundary documented for app/src/features/properties/FieldAnalysisPage.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const FieldAnalysisPage = (): JSX.Element => {
    const { propertyId, fieldName } = useParams<{ propertyId: string; fieldName: string; }>();
    const resolvedPropertyId = propertyId ?? "";
    const resolvedFieldName = fieldName !== undefined ? decodeURIComponent(fieldName) : "";

    const propertyQuery = useQuery({
        enabled: resolvedPropertyId !== "",
        queryFn: () => getProperty(resolvedPropertyId),
        queryKey: propertyKeys.detail(resolvedPropertyId),
    });
    const snapshotsQuery = useQuery({
        enabled: resolvedPropertyId !== "",
        queryFn: () => listPropertySnapshots(resolvedPropertyId, 500),
        queryKey: propertyKeys.snapshots(resolvedPropertyId),
    });

    const analysis = useMemo(() => {
        return analyzeField(resolvedFieldName, snapshotsQuery.data ?? []);
    }, [resolvedFieldName, snapshotsQuery.data]);

    const total = analysis.entries.length;
    const isLowVolume = total > 0 && total < LOW_DATA_THRESHOLD;
    const propertyLabel = propertyQuery.data?.label !== undefined && propertyQuery.data.label !== ""
        ? propertyQuery.data.label
        : propertyQuery.data?.url ?? "Property";

    const kindTone = analysis.kind === "numeric" ? "success" : analysis.kind === "text" ? "neutral" : analysis.kind === "mixed" ? "warning" : "neutral";
    const kindLabel = analysis.kind === "empty" ? "no data" : analysis.kind;

    return (
        <PageStack>
            <PageCard
                action={(
                    <Button as={Link} to={`/properties/${resolvedPropertyId}`} variant={"secondary"}>{"Back to property"}</Button>
                )}
                description={`Field analysis for "${resolvedFieldName}" on ${propertyLabel}.`}
                title={`Analysis · ${resolvedFieldName}`}
            >
                {propertyQuery.isError || snapshotsQuery.isError ? <ErrorBanner>{"Could not load analysis data."}</ErrorBanner> : null}
                <KeyValueGrid compact>
                    <KeyValuePair label={"Entries"} value={total.toLocaleString("en")} />
                    <KeyValuePair label={"Detected type"} value={<StatusBadge tone={kindTone} value={kindLabel} />} />
                    <KeyValuePair label={"Numeric share"} value={`${Math.round(analysis.numericRatio * 100)}%`} />
                    {(() => {
                        const latest = analysis.entries[analysis.entries.length - 1];
                        return latest !== undefined ? <KeyValuePair label={"Latest observation"} value={formatDateTime(latest.observedAt)} /> : null;
                    })()}
                </KeyValueGrid>
            </PageCard>

            {total === 0 ? (
                <PageCard description={"There are no recorded values for this field yet."} title={"Overview"}>
                    <EmptyState message={"Trigger a run to collect values for this field."} />
                </PageCard>
            ) : null}

            {analysis.kind === "numeric" && analysis.numericEntries.length > 0 ? <NumericSection analysis={analysis} /> : null}
            {analysis.kind === "text" && total > 0 ? <TextSection analysis={analysis} /> : null}
            {analysis.kind === "mixed" && total > 0 ? (
                <>
                    <PageCard description={"Values are a mix of numeric and textual entries. Both views are shown."} title={"Mixed Data"}>
                        <KeyValueGrid compact>
                            <KeyValuePair label={"Numeric entries"} value={analysis.numericEntries.length.toLocaleString("en")} />
                            <KeyValuePair label={"Text entries"} value={(total - analysis.numericEntries.length).toLocaleString("en")} />
                        </KeyValueGrid>
                    </PageCard>
                    {analysis.numericEntries.length >= 2 ? <NumericSection analysis={analysis} /> : null}
                    <TextSection analysis={analysis} />
                </>
            ) : null}

            {total > 0 ? <RawValuesCard entries={analysis.entries} limit={isLowVolume ? total : 20} /> : null}
        </PageStack>
    );
};
