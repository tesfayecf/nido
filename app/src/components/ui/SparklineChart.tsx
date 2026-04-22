import { classNames } from "@/lib/ui/classNames";

interface SparklineChartProps {
    readonly className?: string;
    readonly hero?: boolean;
    readonly points: number[];
}

export const SparklineChart = ({ className, hero = false, points }: SparklineChartProps): JSX.Element => {
    if (points.length === 0) {
        return <div className={classNames("sparkline", hero && "sparkline--hero", className)} />;
    }

    const minimum = Math.min(...points);
    const maximum = Math.max(...points);
    const range = maximum - minimum || 1;
    const polylinePoints = points.map((point, index) => {
        const x = (index / Math.max(points.length - 1, 1)) * 100;
        const y = 100 - ((point - minimum) / range) * 100;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg className={classNames("sparkline", hero && "sparkline--hero", className)} preserveAspectRatio={"none"} viewBox={"0 0 100 100"}>
            <polyline className={"sparkline__line"} fill={"none"} points={polylinePoints} strokeWidth={4} />
        </svg>
    );
};
