/**
 * File: app/src/components/ui/SparklineChart.tsx
 *
 * Purpose:
 * Provides a reusable design-system UI building block shared across feature workflows.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react-chartjs-2, @/components/ui/chartTheme, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react-chartjs-2
 * - @/components/ui/chartTheme
 * - @/lib/ui/classNames
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
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { Line } from "react-chartjs-2";

import { createBaseChartOptions, isChartJsdom, useChartTheme } from "@/components/ui/chartTheme";
import { classNames } from "@/lib/ui/classNames";

interface SparklineChartProps {
    readonly className?: string;
    readonly hero?: boolean;
    readonly points: number[];
}

/**
 * Purpose: Renders the SparklineChart UI boundary documented for app/src/components/ui/SparklineChart.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const SparklineChart = ({ className, hero = false, points }: SparklineChartProps): JSX.Element => {
    if (isChartJsdom()) {
        return <div className={classNames("sparkline", hero && "sparkline--hero", className)} />;
    }

    const theme = useChartTheme();

    if (points.length === 0) {
        return <div className={classNames("sparkline", hero && "sparkline--hero", className)} />;
    }

    return (
        <div className={classNames("sparkline", hero && "sparkline--hero", className)}>
            <Line
                data={{
                    datasets: [{
                        backgroundColor: hero ? `${theme.accent}14` : "transparent",
                        borderColor: theme.accent,
                        borderWidth: hero ? 2 : 1.5,
                        data: points,
                        fill: hero,
                        pointHitRadius: 12,
                        pointRadius: 0,
                        tension: 0.25,
                    }],
                    labels: points.map((_, index) => `${index + 1}`),
                }}
                options={{
                    ...createBaseChartOptions<"line">(theme, {
                        hideLegend: true,
                        hideXAxis: true,
                        hideYAxis: true,
                    }),
                    elements: {
                        line: {
                            capBezierPoints: true,
                        },
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                    },
                }}
            />
        </div>
    );
};
