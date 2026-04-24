import { useEffect, useState } from "react";

import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
    type ChartOptions,
    type ChartType,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, Legend, LineElement, LinearScale, PointElement, Tooltip);

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
    accent: "#2f6fed",
    border: "rgba(15, 23, 42, 0.18)",
    grid: "rgba(15, 23, 42, 0.08)",
    muted: "#667085",
    series: ["#2f6fed", "#5b6472", "#4f7d6a", "#946c5c", "#7f56d9", "#b54708"],
    surface: "#ffffff",
    text: "#101828",
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
        readCssVariable("--color-accent", FALLBACK_THEME.series[0] ?? FALLBACK_THEME.accent),
        readCssVariable("--color-text-secondary", FALLBACK_THEME.series[1] ?? FALLBACK_THEME.text),
        readCssVariable("--color-success", FALLBACK_THEME.series[2] ?? FALLBACK_THEME.accent),
        readCssVariable("--color-warning", FALLBACK_THEME.series[3] ?? FALLBACK_THEME.accent),
        "#7f56d9",
        "#b54708",
    ],
    surface: readCssVariable("--color-surface-strong", FALLBACK_THEME.surface),
    text: readCssVariable("--color-text", FALLBACK_THEME.text),
});

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

export const createBaseChartOptions = <TType extends ChartType>(
    theme: ChartTheme,
    options: BaseChartOptions = {},
): ChartOptions<TType> => ({
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
    responsive: true,
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
});
