import type { AnalyticsAggregateDatum, AnalyticsChartType, AnalyticsScatterDatum } from "@/features/analytics/analytics.utils";

interface AnalyticsChartProps {
    readonly chartType: AnalyticsChartType;
    readonly data: AnalyticsAggregateDatum[];
    readonly onHover: (datumId: string | null) => void;
    readonly onSelect: (datumId: string | null) => void;
    readonly scatterData: AnalyticsScatterDatum[];
    readonly selectedId: string | null;
}

const CHART_HEIGHT = 320;
const CHART_WIDTH = 760;
const COLORS = ["#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#ef4444", "#14b8a6"];

export const AnalyticsChart = ({
    chartType,
    data,
    onHover,
    onSelect,
    scatterData,
    selectedId,
}: AnalyticsChartProps): JSX.Element => {
    if (chartType === "scatter") {
        return renderScatterChart({ onHover, onSelect, points: scatterData, selectedId });
    }

    if (chartType === "line") {
        return renderLineChart({ data, onHover, onSelect, selectedId });
    }

    if (chartType === "bar-horizontal") {
        return renderBarChart({ data, horizontal: true, onHover, onSelect, selectedId });
    }

    return renderBarChart({ data, horizontal: false, onHover, onSelect, selectedId });
};

const renderBarChart = ({
    data,
    horizontal,
    onHover,
    onSelect,
    selectedId,
}: {
    readonly data: AnalyticsAggregateDatum[];
    readonly horizontal: boolean;
    readonly onHover: (datumId: string | null) => void;
    readonly onSelect: (datumId: string | null) => void;
    readonly selectedId: string | null;
}): JSX.Element => {
    const maximum = Math.max(...data.map((item) => item.value), 1);
    const barThickness = Math.max(16, Math.floor((horizontal ? CHART_HEIGHT : CHART_WIDTH) / Math.max(data.length, 1)) - 8);
    return (
        <svg preserveAspectRatio={"none"} style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", height: CHART_HEIGHT, width: "100%" }} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
            {data.map((item, index) => {
                const color = COLORS[index % COLORS.length];
                if (horizontal) {
                    const y = 24 + (index * (barThickness + 8));
                    const width = (item.value / maximum) * (CHART_WIDTH - 220);
                    const isSelected = selectedId === item.id;
                    return (
                        <g key={item.id}>
                            <text fill={"var(--color-text-muted)"} fontSize={12} x={16} y={y + (barThickness / 2) + 4}>{item.segment !== "All properties" ? `${item.segment} · ${item.label}` : item.label}</text>
                            <rect
                                aria-label={`${item.label}: ${item.value}`}
                                fill={color}
                                fillOpacity={isSelected ? 1 : 0.82}
                                height={barThickness}
                                onBlur={() => { onHover(null); }}
                                onClick={() => { onSelect(item.id); }}
                                onFocus={() => { onHover(item.id); }}
                                onMouseEnter={() => { onHover(item.id); }}
                                onMouseLeave={() => { onHover(null); }}
                                rx={8}
                                tabIndex={0}
                                width={Math.max(width, 4)}
                                x={200}
                                y={y}
                            />
                        </g>
                    );
                }

                const barWidth = Math.max(18, Math.floor((CHART_WIDTH - 48) / Math.max(data.length, 1)) - 8);
                const x = 24 + (index * (barWidth + 8));
                const height = (item.value / maximum) * (CHART_HEIGHT - 72);
                const y = CHART_HEIGHT - height - 28;
                const isSelected = selectedId === item.id;
                const label = item.segment !== "All properties" ? `${item.segment} · ${item.label}` : item.label;
                return (
                    <g key={item.id}>
                        <rect
                            aria-label={`${label}: ${item.value}`}
                            fill={color}
                            fillOpacity={isSelected ? 1 : 0.82}
                            height={Math.max(height, 4)}
                            onBlur={() => { onHover(null); }}
                            onClick={() => { onSelect(item.id); }}
                            onFocus={() => { onHover(item.id); }}
                            onMouseEnter={() => { onHover(item.id); }}
                            onMouseLeave={() => { onHover(null); }}
                            rx={8}
                            tabIndex={0}
                            width={barWidth}
                            x={x}
                            y={y}
                        />
                        <text fill={"var(--color-text-muted)"} fontSize={11} textAnchor={"middle"} x={x + (barWidth / 2)} y={CHART_HEIGHT - 10}>{truncateLabel(label, 16)}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const renderLineChart = ({
    data,
    onHover,
    onSelect,
    selectedId,
}: {
    readonly data: AnalyticsAggregateDatum[];
    readonly onHover: (datumId: string | null) => void;
    readonly onSelect: (datumId: string | null) => void;
    readonly selectedId: string | null;
}): JSX.Element => {
    const grouped = groupSeries(data);
    const values = data.map((item) => item.value);
    const minimumY = Math.min(...values, 0);
    const maximumY = Math.max(...values, 1);
    const rangeY = maximumY - minimumY || 1;
    const xValues = data.map((item, index) => item.x_value ?? index);
    const minimumX = Math.min(...xValues, 0);
    const maximumX = Math.max(...xValues, 1);
    const rangeX = maximumX - minimumX || 1;

    return (
        <svg preserveAspectRatio={"none"} style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", height: CHART_HEIGHT, width: "100%" }} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
            {grouped.map((series, seriesIndex) => {
                const color = COLORS[seriesIndex % COLORS.length];
                const points = series.items.map((item, index) => {
                    const xValue = item.x_value ?? index;
                    const x = 32 + (((xValue - minimumX) / rangeX) * (CHART_WIDTH - 64));
                    const y = CHART_HEIGHT - 32 - (((item.value - minimumY) / rangeY) * (CHART_HEIGHT - 64));
                    return { ...item, x, y };
                });
                return (
                    <g key={series.segment}>
                        <polyline fill={"none"} points={points.map((point) => `${point.x},${point.y}`).join(" ")} stroke={color} strokeWidth={4} />
                        {points.map((point) => (
                            <circle
                                aria-label={`${point.segment} ${point.label}: ${point.value}`}
                                cx={point.x}
                                cy={point.y}
                                fill={selectedId === point.id ? color : "white"}
                                key={point.id}
                                onBlur={() => { onHover(null); }}
                                onClick={() => { onSelect(point.id); }}
                                onFocus={() => { onHover(point.id); }}
                                onMouseEnter={() => { onHover(point.id); }}
                                onMouseLeave={() => { onHover(null); }}
                                r={selectedId === point.id ? 7 : 5}
                                stroke={color}
                                strokeWidth={3}
                                tabIndex={0}
                            />
                        ))}
                    </g>
                );
            })}
        </svg>
    );
};

const renderScatterChart = ({
    onHover,
    onSelect,
    points,
    selectedId,
}: {
    readonly onHover: (datumId: string | null) => void;
    readonly onSelect: (datumId: string | null) => void;
    readonly points: AnalyticsScatterDatum[];
    readonly selectedId: string | null;
}): JSX.Element => {
    const minimumX = Math.min(...points.map((point) => point.x), 0);
    const maximumX = Math.max(...points.map((point) => point.x), 1);
    const minimumY = Math.min(...points.map((point) => point.y), 0);
    const maximumY = Math.max(...points.map((point) => point.y), 1);
    const rangeX = maximumX - minimumX || 1;
    const rangeY = maximumY - minimumY || 1;
    const segments = Array.from(new Set(points.map((point) => point.segment)));

    return (
        <svg preserveAspectRatio={"none"} style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", height: CHART_HEIGHT, width: "100%" }} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
            {points.map((point) => {
                const segmentIndex = Math.max(segments.indexOf(point.segment), 0);
                const color = COLORS[segmentIndex % COLORS.length];
                const x = 32 + (((point.x - minimumX) / rangeX) * (CHART_WIDTH - 64));
                const y = CHART_HEIGHT - 32 - (((point.y - minimumY) / rangeY) * (CHART_HEIGHT - 64));
                return (
                    <circle
                        aria-label={`${point.label}: ${point.x}, ${point.y}`}
                        cx={x}
                        cy={y}
                        fill={selectedId === point.id ? color : "white"}
                        key={point.id}
                        onBlur={() => { onHover(null); }}
                        onClick={() => { onSelect(point.id); }}
                        onFocus={() => { onHover(point.id); }}
                        onMouseEnter={() => { onHover(point.id); }}
                        onMouseLeave={() => { onHover(null); }}
                        r={selectedId === point.id ? 7 : 5}
                        stroke={color}
                        strokeWidth={3}
                        tabIndex={0}
                    />
                );
            })}
        </svg>
    );
};

const groupSeries = (data: AnalyticsAggregateDatum[]): { readonly items: AnalyticsAggregateDatum[]; readonly segment: string; }[] => {
    const grouped = new Map<string, AnalyticsAggregateDatum[]>();
    for (const item of data) {
        const current = grouped.get(item.segment) ?? [];
        grouped.set(item.segment, [...current, item]);
    }

    return Array.from(grouped.entries()).map(([segment, items]) => ({ items, segment }));
};

const truncateLabel = (label: string, maxLength: number): string => {
    return label.length > maxLength ? `${label.slice(0, Math.max(maxLength - 1, 0))}…` : label;
};
