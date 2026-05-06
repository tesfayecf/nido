/**
 * File: app/src/components/ui/chartTheme.ts
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
 * - Imports: react
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - react
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
import { useEffect, useState } from "react";

import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
    type ChartOptions,
    type ChartType,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip);

interface ChartTheme {
    readonly accent: string;
    readonly border: string;
    readonly grid: string;
    readonly muted: string;
    readonly series: readonly string[];
    readonly surface: string;
    readonly text: string;
}

const FALLBACK_THEME: ChartTheme = {
    accent: "#24527a",
    border: "rgba(15, 23, 42, 0.18)",
    grid: "rgba(15, 23, 42, 0.08)",
    muted: "#6b7280",
    series: ["#24527a", "#4f6b7a", "#185b43", "#a15c00", "#6c7f92", "#7b6859"],
    surface: "#ffffff",
    text: "#101828",
};

const isJsdom = (): boolean => {
    return typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom");
};

/**
 * Purpose: Executes the isChartJsdom operation for app/src/components/ui/chartTheme.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const isChartJsdom = (): boolean => {
    return isJsdom();
};

const readCssVariable = (name: string, fallback: string): string => {
    if (typeof window === "undefined") {
        return fallback;
    }

    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value !== "" ? value : fallback;
};

const readChartTheme = (): ChartTheme => ({
    accent: readCssVariable("--color-accent", FALLBACK_THEME.accent),
    border: readCssVariable("--color-border-strong", FALLBACK_THEME.border),
    grid: readCssVariable("--color-border", FALLBACK_THEME.grid),
    muted: readCssVariable("--color-text-muted", FALLBACK_THEME.muted),
    series: [
        readCssVariable("--color-chart-series-1", FALLBACK_THEME.series[0] ?? FALLBACK_THEME.accent),
        readCssVariable("--color-chart-series-2", FALLBACK_THEME.series[1] ?? FALLBACK_THEME.text),
        readCssVariable("--color-chart-series-3", FALLBACK_THEME.series[2] ?? FALLBACK_THEME.accent),
        readCssVariable("--color-chart-series-4", FALLBACK_THEME.series[3] ?? FALLBACK_THEME.accent),
        readCssVariable("--color-chart-series-5", FALLBACK_THEME.series[4] ?? FALLBACK_THEME.accent),
        readCssVariable("--color-chart-series-6", FALLBACK_THEME.series[5] ?? FALLBACK_THEME.accent),
    ],
    surface: readCssVariable("--color-surface-strong", FALLBACK_THEME.surface),
    text: readCssVariable("--color-text", FALLBACK_THEME.text),
});

/**
 * Purpose: Executes the useChartTheme operation for app/src/components/ui/chartTheme.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const useChartTheme = (): ChartTheme => {
    const [theme, setTheme] = useState<ChartTheme>(() => readChartTheme());

    useEffect(() => {
        if (typeof MutationObserver === "undefined") {
            setTheme(readChartTheme());
            return undefined;
        }

        const root = document.documentElement;
        const observer = new MutationObserver(() => {
            setTheme(readChartTheme());
        });

        observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "style", "class"] });
        setTheme(readChartTheme());
        return () => {
            observer.disconnect();
        };
    }, []);

    return theme;
};

interface BaseChartOptions {
    readonly hideLegend?: boolean;
    readonly hideXAxis?: boolean;
    readonly hideYAxis?: boolean;
}

/**
 * Documents the createBaseChartOptions module export for app/src/components/ui/chartTheme.ts.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const createBaseChartOptions = <TType extends ChartType>(
    theme: ChartTheme,
    options: BaseChartOptions = {},
): ChartOptions<TType> => {
    const baseOptions = {
        animation: false,
        maintainAspectRatio: false,
        normalized: true,
        plugins: {
            legend: {
                display: options.hideLegend !== true,
                labels: {
                    boxHeight: 8,
                    boxWidth: 8,
                    color: theme.muted,
                    font: {
                        size: 11,
                        weight: "600",
                    },
                    padding: 12,
                    usePointStyle: true,
                },
                position: "bottom",
            },
            tooltip: {
                backgroundColor: theme.surface,
                bodyColor: theme.text,
                borderColor: theme.border,
                borderWidth: 1,
                displayColors: false,
                padding: 10,
                titleColor: theme.text,
                titleFont: {
                    size: 12,
                    weight: "600",
                },
            },
        },
        responsive: !isJsdom(),
        scales: {
            x: {
                border: {
                    color: theme.grid,
                },
                display: options.hideXAxis !== true,
                grid: {
                    color: theme.grid,
                    display: options.hideXAxis !== true,
                    drawTicks: false,
                },
                ticks: {
                    color: theme.muted,
                    font: {
                        size: 11,
                    },
                    maxRotation: 0,
                },
            },
            y: {
                border: {
                    color: theme.grid,
                },
                display: options.hideYAxis !== true,
                grid: {
                    color: theme.grid,
                    drawTicks: false,
                },
                ticks: {
                    color: theme.muted,
                    font: {
                        size: 11,
                    },
                },
            },
        },
    };

    return baseOptions as unknown as ChartOptions<TType>;
};
