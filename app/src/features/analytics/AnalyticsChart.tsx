import { Bar, Line, Scatter } from "react-chartjs-2";
import type { ActiveElement, ChartDataset, ChartOptions } from "chart.js";

import { createBaseChartOptions, isChartJsdom, useChartTheme } from "@/components/ui/chartTheme";
import type { AnalyticsAggregateDatum, AnalyticsChartType, AnalyticsScatterDatum } from "@/features/analytics/analytics.utils";

interface AnalyticsChartProps {
    readonly chartType: AnalyticsChartType;
    readonly data: AnalyticsAggregateDatum[];
    readonly onHover: (datumId: string | null) => void;
    readonly onSelect: (datumId: string | null) => void;
    readonly scatterData: AnalyticsScatterDatum[];
    readonly selectedId: string | null;
}

interface CartesianLookup {
    readonly datasets: ChartDataset<"bar" | "line", (number | null)[]>[];
    readonly labels: string[];
    readonly lookupByDataset: (AnalyticsAggregateDatum | undefined)[][];
    readonly showLegend: boolean;
}

interface ScatterPoint {
    readonly datumId: string;
    readonly label: string;
    readonly x: number;
    readonly y: number;
}

export const AnalyticsChart = ({
    chartType,
    data,
    onHover,
    onSelect,
    scatterData,
    selectedId,
}: AnalyticsChartProps): JSX.Element => {
    if (isChartJsdom()) {
        return <div aria-label={`${chartType} chart`} className={"enterprise-chart"} />;
    }

    const theme = useChartTheme();

    if (chartType === "scatter") {
        const lookup = buildScatterLookup(scatterData, theme.series, theme.accent, selectedId, theme.surface);
        const options = createScatterOptions(theme, lookup.showLegend, onHover, onSelect);

        return (
            <div className={"enterprise-chart"}>
                <Scatter data={{ datasets: lookup.datasets }} options={options} />
            </div>
        );
    }

    const lookup = buildCartesianLookup(data, chartType, theme.series, theme.accent, selectedId, theme.surface);
    const sharedOptions = createCartesianOptions(theme, lookup.showLegend, lookup.lookupByDataset, onHover, onSelect);

    if (chartType === "line") {
        return (
            <div className={"enterprise-chart"}>
                <Line
                    data={{
                        datasets: lookup.datasets as unknown as ChartDataset<"line", (number | null)[]>[],
                        labels: lookup.labels,
                    }}
                    options={sharedOptions as ChartOptions<"line">}
                />
            </div>
        );
    }

    return (
        <div className={"enterprise-chart"}>
            <Bar
                data={{
                    datasets: lookup.datasets as unknown as ChartDataset<"bar", (number | null)[]>[],
                    labels: lookup.labels,
                }}
                options={{
                    ...(sharedOptions as ChartOptions<"bar">),
                    indexAxis: chartType === "bar-horizontal" ? "y" : "x",
                }}
            />
        </div>
    );
};

const buildCartesianLookup = (
    data: AnalyticsAggregateDatum[],
    chartType: AnalyticsChartType,
    palette: readonly string[],
    accentColor: string,
    selectedId: string | null,
    surfaceColor: string,
): CartesianLookup => {
    const labels = Array.from(new Set(data.map((item) => item.label)));
    const labelIndex = new Map(labels.map((label, index) => [label, index]));
    const segments = Array.from(new Set(data.map((item) => item.segment.trim() !== "" ? item.segment : "All properties")));
    const showLegend = chartType === "line" || segments.length > 1;
    const lookupByDataset = segments.map(() => new Array<AnalyticsAggregateDatum | undefined>(labels.length).fill(undefined));

    const datasets = segments.map((segment, segmentIndex) => {
        const color = palette[segmentIndex % palette.length] ?? palette[0] ?? accentColor;
        const values = new Array<number | null>(labels.length).fill(null);
        const backgroundColor = new Array<string>(labels.length).fill(`${color}cc`);
        const pointBackgroundColor = new Array<string>(labels.length).fill(surfaceColor);
        const pointRadius = new Array<number>(labels.length).fill(3);

        data.filter((item) => (item.segment.trim() !== "" ? item.segment : "All properties") === segment).forEach((item) => {
            const index = labelIndex.get(item.label);
            if (index === undefined) {
                return;
            }

            const currentLookup = lookupByDataset[segmentIndex];
            if (currentLookup === undefined) {
                return;
            }

            const isSelected = selectedId === item.id;
            values[index] = item.value;
            currentLookup[index] = item;
            backgroundColor[index] = isSelected ? color : `${color}cc`;
            pointBackgroundColor[index] = isSelected ? color : surfaceColor;
            pointRadius[index] = isSelected ? 5 : 3;
        });

        return {
            backgroundColor,
            borderColor: color,
            borderWidth: 1.5,
            data: values,
            label: segment,
            pointBackgroundColor,
            pointBorderColor: color,
            pointHoverRadius: 5,
            pointRadius,
        } satisfies ChartDataset<"bar" | "line", (number | null)[]>;
    });

    return { datasets, labels, lookupByDataset, showLegend };
};

const createCartesianOptions = (
    theme: ReturnType<typeof useChartTheme>,
    showLegend: boolean,
    lookupByDataset: CartesianLookup["lookupByDataset"],
    onHover: (datumId: string | null) => void,
    onSelect: (datumId: string | null) => void,
): ChartOptions<"bar" | "line"> => {
    const base = createBaseChartOptions<"bar" | "line">(theme, { hideLegend: !showLegend });

    return {
        ...base,
        interaction: {
            intersect: false,
            mode: "nearest",
        },
        onClick: (_event, elements) => {
            onSelect(resolveAggregateId(elements, lookupByDataset));
        },
        onHover: (_event, elements) => {
            onHover(resolveAggregateId(elements, lookupByDataset));
        },
        plugins: {
            ...base.plugins,
            tooltip: {
                ...base.plugins?.tooltip,
                callbacks: {
                    label: (context) => {
                        const datum = lookupByDataset[context.datasetIndex]?.[context.dataIndex];
                        if (datum === undefined) {
                            return context.formattedValue;
                        }

                        return `${datum.segment !== "" ? `${datum.segment} · ` : ""}${datum.value.toLocaleString("en")}`;
                    },
                    title: (items) => {
                        const item = items[0];
                        const datum = item === undefined ? undefined : lookupByDataset[item.datasetIndex]?.[item.dataIndex];
                        return datum?.label ?? item?.label ?? "";
                    },
                },
            },
        },
        scales: {
            ...base.scales,
            x: {
                ...base.scales?.x,
                ticks: {
                    ...base.scales?.x?.ticks,
                    callback: (_value, index) => {
                        const label = lookupByDataset[0]?.[index]?.label ?? "";
                        return label.length > 18 ? `${label.slice(0, 17)}…` : label;
                    },
                },
            },
        },
    };
};

const resolveAggregateId = (
    elements: readonly ActiveElement[],
    lookupByDataset: CartesianLookup["lookupByDataset"],
): string | null => {
    const first = elements[0];
    if (first === undefined) {
        return null;
    }

    return lookupByDataset[first.datasetIndex]?.[first.index]?.id ?? null;
};

const buildScatterLookup = (
    data: AnalyticsScatterDatum[],
    palette: readonly string[],
    accentColor: string,
    selectedId: string | null,
    surfaceColor: string,
): {
    readonly datasets: ChartDataset<"scatter", ScatterPoint[]>[];
    readonly showLegend: boolean;
} => {
    const segments = Array.from(new Set(data.map((item) => item.segment)));

    return {
        datasets: segments.map((segment, segmentIndex) => {
            const segmentData = data.filter((item) => item.segment === segment);
            const color = palette[segmentIndex % palette.length] ?? palette[0] ?? accentColor;
            return {
                backgroundColor: color,
                borderColor: color,
                data: segmentData.map((item) => ({
                    datumId: item.id,
                    label: item.label,
                    x: item.x,
                    y: item.y,
                })),
                label: segment,
                pointBackgroundColor: segmentData.map((item) => selectedId === item.id ? color : surfaceColor),
                pointBorderColor: color,
                pointHoverRadius: 6,
                pointRadius: segmentData.map((item) => selectedId === item.id ? 6 : 4),
            } satisfies ChartDataset<"scatter", ScatterPoint[]>;
        }),
        showLegend: segments.length > 1,
    };
};

const createScatterOptions = (
    theme: ReturnType<typeof useChartTheme>,
    showLegend: boolean,
    onHover: (datumId: string | null) => void,
    onSelect: (datumId: string | null) => void,
): ChartOptions<"scatter"> => {
    const base = createBaseChartOptions<"scatter">(theme, { hideLegend: !showLegend });

    return {
        ...base,
        interaction: {
            intersect: false,
            mode: "nearest",
        },
        onClick: (_event, elements, chart) => {
            onSelect(resolveScatterId(elements, chart.data as unknown as { readonly datasets: { readonly data: ScatterPoint[]; }[]; }));
        },
        onHover: (_event, elements, chart) => {
            onHover(resolveScatterId(elements, chart.data as unknown as { readonly datasets: { readonly data: ScatterPoint[]; }[]; }));
        },
        plugins: {
            ...base.plugins,
            tooltip: {
                ...base.plugins?.tooltip,
                callbacks: {
                    label: (context) => {
                        const point = context.raw as ScatterPoint;
                        return `${point.x.toLocaleString("en")} × ${point.y.toLocaleString("en")}`;
                    },
                    title: (items) => {
                        const point = items[0]?.raw as ScatterPoint | undefined;
                        return point?.label ?? "";
                    },
                },
            },
        },
    };
};

const resolveScatterId = (
    elements: readonly ActiveElement[],
    chartData: { readonly datasets: { readonly data: ScatterPoint[]; }[]; },
): string | null => {
    const first = elements[0];
    if (first === undefined) {
        return null;
    }

    return chartData.datasets[first.datasetIndex]?.data[first.index]?.datumId ?? null;
};
