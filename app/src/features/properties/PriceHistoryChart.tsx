import { Line } from "react-chartjs-2";

import { createBaseChartOptions, isChartJsdom, useChartTheme } from "@/components/ui/chartTheme";
import { formatCurrency } from "@/lib/format/currency";
import { classNames } from "@/lib/ui/classNames";
import type { PriceHistoryPoint } from "@/features/properties/propertyHistory";

interface PriceHistoryChartProps {
    readonly className?: string;
    readonly compact?: boolean;
    readonly points: readonly PriceHistoryPoint[];
}

export const PriceHistoryChart = ({
    className,
    compact = false,
    points,
}: PriceHistoryChartProps): JSX.Element => {
    if (isChartJsdom()) {
        return <div className={classNames(compact ? "sparkline" : "enterprise-chart", className)} />;
    }

    const theme = useChartTheme();
    const baseOptions = createBaseChartOptions<"line">(theme, {
        hideLegend: true,
        hideXAxis: compact,
        hideYAxis: compact,
    });

    return (
        <div className={classNames(compact ? "sparkline sparkline--compact" : "enterprise-chart", className)}>
            <Line
                data={{
                    datasets: [{
                        backgroundColor: compact ? "transparent" : `${theme.accent}14`,
                        borderColor: theme.accent,
                        borderWidth: compact ? 1.5 : 2,
                        data: points.map((point) => point.value),
                        fill: !compact,
                        pointHitRadius: 16,
                        pointRadius: compact ? 0 : 3,
                        tension: 0.2,
                    }],
                    labels: points.map((point) => point.label),
                }}
                options={{
                    ...baseOptions,
                    plugins: {
                        ...baseOptions.plugins,
                        legend: { display: false },
                        tooltip: compact ? { enabled: false } : {
                            ...baseOptions.plugins?.tooltip,
                            callbacks: {
                                label: (context) => {
                                    const point = points[context.dataIndex];
                                    return point === undefined
                                        ? context.formattedValue
                                        : `${formatCurrency(point.value, "EUR")} · ${new Date(point.observedAt).toLocaleString("en-GB")}`;
                                },
                                title: (items) => points[items[0]?.dataIndex ?? 0]?.label ?? "",
                            },
                        },
                    },
                    scales: compact ? undefined : {
                        ...baseOptions.scales,
                        x: {
                            ...baseOptions.scales?.x,
                            ticks: {
                                ...baseOptions.scales?.x?.ticks,
                                callback: (_value, index) => points[index]?.label ?? "",
                            },
                        },
                        y: {
                            ...baseOptions.scales?.y,
                            ticks: {
                                ...baseOptions.scales?.y?.ticks,
                                callback: (value) => formatCurrency(Number(value), "EUR"),
                            },
                        },
                    },
                }}
            />
        </div>
    );
};
