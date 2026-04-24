import type { AnalyticsRecord } from "@/services/analytics/analytics.types";
import type { FieldDataType, FieldDefinitionUsage } from "@/services/fields/fields.types";

export type AnalyticsChartType = "bar" | "bar-horizontal" | "histogram" | "line" | "scatter";
export type AnalyticsMetric = "average" | "count" | "max" | "median" | "min";
export type AnalyticsFilterOperator = "between" | "equals";

export interface AnalyticsFieldOption {
    readonly data_type: FieldDataType | "date" | "string";
    readonly label: string;
    readonly name: string;
    readonly unit?: string;
}

export interface AnalyticsFilterDraft {
    readonly field_name: string;
    readonly id: string;
    readonly max: string;
    readonly min: string;
    readonly operator: AnalyticsFilterOperator;
    readonly value: string;
}

export interface AnalyticsAggregateDatum {
    readonly id: string;
    readonly label: string;
    readonly records: AnalyticsRecord[];
    readonly segment: string;
    readonly value: number;
    readonly x_value?: number;
}

export interface AnalyticsScatterDatum {
    readonly id: string;
    readonly label: string;
    readonly record: AnalyticsRecord;
    readonly segment: string;
    readonly x: number;
    readonly y: number;
}

export interface AnalyticsSummary {
    readonly average?: number;
    readonly max?: number;
    readonly measure_count: number;
    readonly median?: number;
    readonly min?: number;
    readonly total_records: number;
}

const UNKNOWN_LABEL = "Unknown";
const NUMERIC_PATTERN = /^-?\d+(?:[.,]\d+)?$/u;
const NUMERIC_EXTRACT = /-?\d[\d.,]*/u;

export const buildAnalyticsFieldOptions = (fieldDefinitions: FieldDefinitionUsage[]): AnalyticsFieldOption[] => {
    return [
        ...fieldDefinitions.map((field) => ({
            data_type: field.data_type,
            label: field.display_name,
            name: field.name,
            unit: field.unit,
        })),
        { data_type: "string", label: "Status", name: "status" },
        { data_type: "string", label: "Source", name: "source_id" },
        { data_type: "date", label: "Observed at", name: "observed_at" },
    ];
};

export const parseNumeric = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (trimmed === "") {
        return undefined;
    }

    const direct = trimmed.replace(/,(?=\d{3}(?!\d))/gu, "").replace(/,/gu, ".");
    if (NUMERIC_PATTERN.test(direct)) {
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

export const filterAnalyticsRecords = (
    records: AnalyticsRecord[],
    filters: AnalyticsFilterDraft[],
    fieldOptions: AnalyticsFieldOption[],
): AnalyticsRecord[] => {
    return records.filter((record) => {
        return filters.every((filter) => {
            if (filter.field_name.trim() === "") {
                return true;
            }

            const field = fieldOptions.find((candidate) => candidate.name === filter.field_name);
            const rawValue = getRecordValue(record, filter.field_name);
            if (field === undefined) {
                return true;
            }

            if (field.data_type === "number") {
                const numericValue = rawValue !== undefined ? parseNumeric(rawValue) : undefined;
                if (numericValue === undefined) {
                    return false;
                }

                if (filter.operator === "between") {
                    const minValue = filter.min.trim() !== "" ? Number(filter.min) : undefined;
                    const maxValue = filter.max.trim() !== "" ? Number(filter.max) : undefined;
                    if (minValue !== undefined && numericValue < minValue) {
                        return false;
                    }

                    if (maxValue !== undefined && numericValue > maxValue) {
                        return false;
                    }

                    return true;
                }

                const expected = filter.value.trim() !== "" ? Number(filter.value) : undefined;
                return expected !== undefined && numericValue === expected;
            }

            if (field.data_type === "date") {
                if (rawValue === undefined) {
                    return false;
                }

                if (filter.operator === "between") {
                    const observedAt = new Date(rawValue).getTime();
                    if (!Number.isFinite(observedAt)) {
                        return false;
                    }

                    const minValue = filter.min.trim() !== "" ? new Date(filter.min).getTime() : undefined;
                    const maxValue = filter.max.trim() !== "" ? new Date(filter.max).getTime() : undefined;
                    if (minValue !== undefined && observedAt < minValue) {
                        return false;
                    }

                    if (maxValue !== undefined && observedAt > maxValue) {
                        return false;
                    }

                    return true;
                }
            }

            return normalizeComparableValue(rawValue) === normalizeComparableValue(filter.value);
        });
    });
};

export const buildAnalyticsSummary = (
    records: AnalyticsRecord[],
    measureFieldName: string,
): AnalyticsSummary => {
    const values = records.map((record) => readNumericField(record, measureFieldName)).filter(isNumber);
    const sorted = values.slice().sort((left, right) => left - right);
    return {
        average: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined,
        max: sorted[sorted.length - 1],
        measure_count: values.length,
        median: median(sorted),
        min: sorted[0],
        total_records: records.length,
    };
};

export const buildHistogramData = (
    records: AnalyticsRecord[],
    measureFieldName: string,
): AnalyticsAggregateDatum[] => {
    const entries = records
        .map((record) => {
            const value = readNumericField(record, measureFieldName);
            return value === undefined ? undefined : { record, value };
        })
        .filter((entry): entry is { readonly record: AnalyticsRecord; readonly value: number; } => entry !== undefined);
    if (entries.length === 0) {
        return [];
    }

    const values = entries.map((entry) => entry.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    if (minimum === maximum) {
        return [{
            id: "histogram-0",
            label: formatRangeLabel(minimum, maximum),
            records: entries.map((entry) => entry.record),
            segment: "",
            value: entries.length,
            x_value: minimum,
        }];
    }

    const bucketCount = Math.max(4, Math.min(12, Math.round(Math.sqrt(entries.length))));
    const width = (maximum - minimum) / bucketCount;
    const bins: AnalyticsAggregateDatum[] = Array.from({ length: bucketCount }, (_, index) => {
        const start = minimum + (index * width);
        const end = minimum + ((index + 1) * width);
        return {
            id: `histogram-${index}`,
            label: formatRangeLabel(start, end),
            records: [],
            segment: "",
            value: 0,
            x_value: start + (width / 2),
        };
    });

    for (const entry of entries) {
        let index = Math.floor((entry.value - minimum) / width);
        if (index >= bucketCount) {
            index = bucketCount - 1;
        }

        if (index < 0) {
            index = 0;
        }

        const current = bins[index];
        if (current !== undefined) {
            bins[index] = {
                ...current,
                records: [...current.records, entry.record],
                value: current.value + 1,
            };
        }
    }

    return bins.filter((bin) => bin.value > 0);
};

export const buildGroupedAnalytics = (
    records: AnalyticsRecord[],
    parameterFieldName: string,
    measureFieldName: string,
    metric: AnalyticsMetric,
    segmentFieldName: string,
    fieldOptions: AnalyticsFieldOption[],
): AnalyticsAggregateDatum[] => {
    const parameterField = fieldOptions.find((field) => field.name === parameterFieldName);
    const parameterResolver = buildCategoryResolver(records, parameterFieldName, parameterField);
    const segmentResolver = buildSegmentResolver(records, segmentFieldName, fieldOptions.find((field) => field.name === segmentFieldName));
    const grouped = new Map<string, { readonly label: string; readonly records: AnalyticsRecord[]; readonly segment: string; readonly values: number[]; readonly xValue?: number; }>();

    for (const record of records) {
        const category = parameterResolver(record);
        const segment = segmentResolver(record);
        const numericValue = readNumericField(record, measureFieldName);
        if (metric !== "count" && numericValue === undefined) {
            continue;
        }

        const key = `${segment.label}::${category.label}`;
        const current = grouped.get(key);
        const nextValues = metric === "count"
            ? (current?.values ?? [])
            : [...current?.values ?? [], numericValue ?? 0];
        grouped.set(key, {
            label: category.label,
            records: [...current?.records ?? [], record],
            segment: segment.label,
            values: nextValues,
            xValue: category.x_value,
        });
    }

    return Array.from(grouped.entries())
        .map(([key, item]) => ({
            id: key,
            label: item.label,
            records: item.records,
            segment: item.segment,
            value: aggregateMetric(item.values, item.records.length, metric),
            x_value: item.xValue,
        }))
        .filter((item) => Number.isFinite(item.value))
        .sort((left, right) => {
            if (left.x_value !== undefined && right.x_value !== undefined) {
                return left.x_value - right.x_value || left.segment.localeCompare(right.segment);
            }

            return left.label.localeCompare(right.label) || left.segment.localeCompare(right.segment);
        });
};

export const buildScatterAnalytics = (
    records: AnalyticsRecord[],
    parameterFieldName: string,
    measureFieldName: string,
    segmentFieldName: string,
): AnalyticsScatterDatum[] => {
    return records
        .map((record) => {
            const xValue = readNumericField(record, parameterFieldName);
            const yValue = readNumericField(record, measureFieldName);
            if (xValue === undefined || yValue === undefined) {
                return undefined;
            }

            const label = record.property_label?.trim() !== "" ? record.property_label ?? record.property_id : record.property_id;
            const segment = segmentFieldName.trim() === "" ? "All properties" : (getRecordValue(record, segmentFieldName) ?? UNKNOWN_LABEL);
            return {
                id: `${record.property_id}-${parameterFieldName}-${measureFieldName}`,
                label,
                record,
                segment,
                x: xValue,
                y: yValue,
            };
        })
        .filter((item): item is AnalyticsScatterDatum => item !== undefined)
        .sort((left, right) => left.x - right.x || left.y - right.y);
};

export const formatMetricValue = (value: number, unit?: string): string => {
    const formatted = value.toLocaleString("en", {
        maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
        minimumFractionDigits: 0,
    });
    return unit !== undefined && unit.trim() !== "" ? `${formatted} ${unit}` : formatted;
};

export const metricLabel = (metric: AnalyticsMetric): string => {
    switch (metric) {
        case "average":
            return "Average";
        case "count":
            return "Count";
        case "max":
            return "Maximum";
        case "median":
            return "Median";
        case "min":
            return "Minimum";
        default:
            return metric;
    }
};

const getRecordValue = (record: AnalyticsRecord, fieldName: string): string | undefined => {
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

const readNumericField = (record: AnalyticsRecord, fieldName: string): number | undefined => {
    const value = getRecordValue(record, fieldName);
    return value !== undefined ? parseNumeric(value) : undefined;
};

const buildCategoryResolver = (
    records: AnalyticsRecord[],
    fieldName: string,
    field: AnalyticsFieldOption | undefined,
): ((record: AnalyticsRecord) => { readonly label: string; readonly x_value?: number; }) => {
    if (fieldName.trim() === "") {
        return () => ({ label: "All properties" });
    }

    if (field?.data_type === "number") {
        const values = records.map((record) => readNumericField(record, fieldName)).filter(isNumber);
        if (values.length === 0) {
            return () => ({ label: UNKNOWN_LABEL });
        }

        const uniqueValues = new Set(values.map((value) => value.toFixed(2)));
        if (uniqueValues.size <= 8) {
            return (record) => {
                const value = readNumericField(record, fieldName);
                return value === undefined
                    ? { label: UNKNOWN_LABEL }
                    : { label: formatMetricValue(value), x_value: value };
            };
        }

        const minimum = Math.min(...values);
        const maximum = Math.max(...values);
        const bucketCount = Math.max(4, Math.min(8, Math.round(Math.sqrt(values.length))));
        const width = (maximum - minimum) / bucketCount || 1;
        return (record) => {
            const value = readNumericField(record, fieldName);
            if (value === undefined) {
                return { label: UNKNOWN_LABEL };
            }

            let index = Math.floor((value - minimum) / width);
            if (index >= bucketCount) {
                index = bucketCount - 1;
            }

            if (index < 0) {
                index = 0;
            }

            const start = minimum + (index * width);
            const end = minimum + ((index + 1) * width);
            return {
                label: formatRangeLabel(start, end),
                x_value: start + (width / 2),
            };
        };
    }

    if (field?.data_type === "date") {
        return (record) => {
            const raw = getRecordValue(record, fieldName);
            if (raw === undefined) {
                return { label: UNKNOWN_LABEL };
            }

            const date = new Date(raw);
            if (Number.isNaN(date.getTime())) {
                return { label: UNKNOWN_LABEL };
            }

            return {
                label: date.toLocaleDateString("en-CA"),
                x_value: date.getTime(),
            };
        };
    }

    return (record) => ({ label: getRecordValue(record, fieldName) ?? UNKNOWN_LABEL });
};

const buildSegmentResolver = (
    records: AnalyticsRecord[],
    fieldName: string,
    field: AnalyticsFieldOption | undefined,
): ((record: AnalyticsRecord) => { readonly label: string; }) => {
    if (fieldName.trim() === "") {
        return () => ({ label: "All properties" });
    }

    if (field?.data_type === "number") {
        const categoryResolver = buildCategoryResolver(records, fieldName, field);
        return (record) => ({ label: categoryResolver(record).label });
    }

    return (record) => ({ label: getRecordValue(record, fieldName) ?? UNKNOWN_LABEL });
};

const aggregateMetric = (values: number[], recordCount: number, metric: AnalyticsMetric): number => {
    switch (metric) {
        case "average":
            return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
        case "count":
            return recordCount;
        case "max":
            return values.length > 0 ? Math.max(...values) : Number.NaN;
        case "median":
            return median(values.slice().sort((left, right) => left - right)) ?? Number.NaN;
        case "min":
            return values.length > 0 ? Math.min(...values) : Number.NaN;
        default:
            return Number.NaN;
    }
};

const median = (sorted: number[]): number | undefined => {
    if (sorted.length === 0) {
        return undefined;
    }

    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        const left = sorted[mid - 1];
        const right = sorted[mid];
        return left !== undefined && right !== undefined ? (left + right) / 2 : undefined;
    }

    return sorted[mid];
};

const formatRangeLabel = (start: number, end: number): string => {
    return `${formatMetricValue(start)} – ${formatMetricValue(end)}`;
};

const normalizeComparableValue = (value: string | undefined): string => {
    return (value ?? "").trim().toLowerCase();
};

const isNumber = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);
