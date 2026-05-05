/**
 * File: app/src/features/properties/PriceHistoryChart.tsx
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
 * - Imports: react-chartjs-2, @/components/ui/chartTheme, @/lib/format/currency, @/lib/ui/classNames, @/features/properties/propertyHistory
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react-chartjs-2
 * - @/components/ui/chartTheme
 * - @/lib/format/currency
 * - @/lib/ui/classNames
 * - @/features/properties/propertyHistory
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

/**
 * Purpose: Renders the PriceHistoryChart UI boundary documented for app/src/features/properties/PriceHistoryChart.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
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
