import type { DecisionContext, PropertySummary } from "@/services/properties/properties.types";

const formatPrice = (value: number | undefined): string => {
    if (value === undefined) {
        return "—";
    }

    return new Intl.NumberFormat("en-IE", {
        currency: "EUR",
        maximumFractionDigits: 0,
        style: "currency",
    }).format(value);
};

const formatPct = (value: number | undefined, opts?: { readonly sign?: boolean; }): string => {
    if (value === undefined) {
        return "—";
    }

    const sign = opts?.sign === true && value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
};

interface FreshnessChipProps {
    readonly status: DecisionContext["freshness_status"];
}

const FreshnessChip = ({ status }: FreshnessChipProps): JSX.Element => {
    const styles: Record<string, string> = {
        aging: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        fresh: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        stale: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        unknown: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    };
    const dotClass = status === "fresh" ? "bg-green-500" : status === "stale" ? "bg-red-500" : status === "aging" ? "bg-amber-500" : "bg-zinc-400";

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.unknown}`}>
            <span className={`size-1.5 rounded-full ${dotClass}`} />
            {status}
        </span>
    );
};

interface StageChipProps {
    readonly stage: string | undefined;
}

const StageChip = ({ stage }: StageChipProps): JSX.Element | null => {
    if (stage === undefined || stage === "") {
        return null;
    }

    return (
        <span className={"inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300"}>
            {stage.replace(/_/g, " ")}
        </span>
    );
};

interface PriorityChipProps {
    readonly level: string | undefined;
}

const PriorityChip = ({ level }: PriorityChipProps): JSX.Element | null => {
    if (level === undefined || level === "") {
        return null;
    }

    const styles: Record<string, string> = {
        critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    };

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[level.toLowerCase()] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
            {level.replace(/_/g, " ")}
        </span>
    );
};

interface DecisionStripProps {
    readonly compact?: boolean;
    readonly summary: PropertySummary;
}

export const DecisionStrip = ({ compact = false, summary }: DecisionStripProps): JSX.Element => {
    const { decision, latest_change_summary } = summary;
    const gapTone = decision.price_gap_percent !== undefined && decision.price_gap_percent > 0
        ? "text-red-600 dark:text-red-400"
        : "text-green-600 dark:text-green-400";

    if (compact) {
        return (
            <div className={"flex flex-wrap items-center gap-2 text-sm"}>
                {decision.current_price !== undefined ? (
                    <span className={"font-semibold text-zinc-900 dark:text-zinc-100"}>
                        {formatPrice(decision.current_price)}
                    </span>
                ) : null}
                {decision.price_gap_percent !== undefined ? (
                    <span className={`text-xs font-medium ${gapTone}`} title={`Target: ${formatPrice(decision.target_price)}`}>
                        {formatPct(decision.price_gap_percent, { sign: true })}{" vs target"}
                    </span>
                ) : null}
                <FreshnessChip status={decision.freshness_status} />
                {latest_change_summary !== "" && <span className={"text-xs text-zinc-500 dark:text-zinc-400"}>{latest_change_summary}</span>}
            </div>
        );
    }

    return (
        <div className={"rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"}>
            <div className={"flex flex-wrap items-center gap-4"}>
                <div>
                    <p className={"text-xs text-zinc-500 dark:text-zinc-400"}>{"Current price"}</p>
                    <p className={"text-xl font-bold text-zinc-900 dark:text-zinc-100"}>
                        {formatPrice(decision.current_price)}
                    </p>
                </div>

                {decision.target_price !== undefined ? (
                    <div>
                        <p className={"text-xs text-zinc-500 dark:text-zinc-400"}>{"Target"}</p>
                        <p className={"text-xl font-semibold text-zinc-700 dark:text-zinc-300"}>
                            {formatPrice(decision.target_price)}
                        </p>
                    </div>
                ) : null}

                {decision.price_gap_percent !== undefined ? (
                    <div>
                        <p className={"text-xs text-zinc-500 dark:text-zinc-400"}>{"Gap vs target"}</p>
                        <p className={`text-xl font-semibold ${gapTone}`}>
                            {formatPct(decision.price_gap_percent, { sign: true })}
                        </p>
                    </div>
                ) : null}

                {decision.current_price_per_sqm !== undefined ? (
                    <div>
                        <p className={"text-xs text-zinc-500 dark:text-zinc-400"}>{"€/m²"}</p>
                        <p className={"text-xl font-semibold text-zinc-800 dark:text-zinc-200"}>
                            {formatPrice(decision.current_price_per_sqm)}
                        </p>
                    </div>
                ) : null}

                <div className={"ml-auto flex flex-wrap items-center gap-2"}>
                    <FreshnessChip status={decision.freshness_status} />
                    <StageChip stage={decision.stage} />
                    <PriorityChip level={decision.priority_level} />
                </div>
            </div>

            {latest_change_summary !== "" || decision.deal_thesis_summary !== undefined ? (
                <div className={"mt-3 flex flex-col gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-700"}>
                    {latest_change_summary !== "" ? (
                        <p className={"text-sm font-medium text-zinc-700 dark:text-zinc-300"}>
                            {"📡 "}{latest_change_summary}
                        </p>
                    ) : null}
                    {decision.deal_thesis_summary !== undefined ? (
                        <p className={"text-sm italic text-zinc-500 dark:text-zinc-400"}>
                            {decision.deal_thesis_summary}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

export default DecisionStrip;
