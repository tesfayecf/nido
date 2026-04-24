import { Line } from "react-chartjs-2";

import { createBaseChartOptions, useChartTheme } from "@/components/ui/chartTheme";
import { classNames } from "@/lib/ui/classNames";

interface SparklineChartProps {
    readonly className?: string;
    readonly hero?: boolean;
    readonly points: number[];
}

export const SparklineChart = ({ className, hero = false, points }: SparklineChartProps): JSX.Element => {
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
