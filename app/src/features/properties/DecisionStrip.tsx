import type { DecisionContext, PropertySummary } from "@/services/properties/properties.types";

// ── formatters ────────────────────────────────────────────────────────────────

function formatPrice(value: number | undefined): string {
    if (value === undefined) return "—";
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatPct(value: number | undefined, opts?: { sign?: boolean }): string {
    if (value === undefined) return "—";
    const sign = opts?.sign && value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
}

// ── FreshnessChip ─────────────────────────────────────────────────────────────

interface FreshnessChipProps {
    readonly status: DecisionContext["freshness_status"];
}

function FreshnessChip({ status }: FreshnessChipProps) {
    const styles: Record<string, string> = {
        fresh: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        stale: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        unknown: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    };
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.unknown}`}
        >
            <span
                className={`size-1.5 rounded-full ${status === "fresh" ? "bg-green-500" : status === "stale" ? "bg-amber-500" : "bg-zinc-400"}`}
            />
            {status}
        </span>
    );
}

// ── StageChip ─────────────────────────────────────────────────────────────────

interface StageChipProps {
    readonly stage: string | undefined;
}

function StageChip({ stage }: StageChipProps) {
    if (!stage) return null;
    return (
        <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
            {stage.replace(/_/g, " ")}
        </span>
    );
}

// ── PriorityChip ──────────────────────────────────────────────────────────────

interface PriorityChipProps {
    readonly level: string | undefined;
}

function PriorityChip({ level }: PriorityChipProps) {
    if (!level) return null;
    const styles: Record<string, string> = {
        critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
        low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    };
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[level.toLowerCase()] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
        >
            {level.replace(/_/g, " ")}
        </span>
    );
}

// ── DecisionStrip ─────────────────────────────────────────────────────────────

interface DecisionStripProps {
    readonly summary: PropertySummary;
    /** When true renders a compact horizontal strip suitable for list views */
    readonly compact?: boolean;
}

/**
 * DecisionStrip renders the acquisition decision context in a compact strip
 * showing current price, target gap, freshness, stage, and priority.
 */
export function DecisionStrip({ summary, compact = false }: DecisionStripProps) {
    const { decision, latest_change_summary } = summary;

    if (compact) {
        return (
            <div className="flex flex-wrap items-center gap-2 text-sm">
                {decision.current_price !== undefined && (
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatPrice(decision.current_price)}
                    </span>
                )}
                {decision.price_gap_percent !== undefined && (
                    <span
                        className={`text-xs font-medium ${
                            decision.price_gap_percent > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                        }`}
                        title={`Target: ${formatPrice(decision.target_price)}`}
                    >
                        {formatPct(decision.price_gap_percent, { sign: true })} vs target
                    </span>
                )}
                <FreshnessChip status={decision.freshness_status} />
                {latest_change_summary !== "" && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{latest_change_summary}</span>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            {/* Row 1: price, target, gap, freshness */}
            <div className="flex flex-wrap items-center gap-4">
                <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Current price</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {formatPrice(decision.current_price)}
                    </p>
                </div>

                {decision.target_price !== undefined && (
                    <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Target</p>
                        <p className="text-xl font-semibold text-zinc-700 dark:text-zinc-300">
                            {formatPrice(decision.target_price)}
                        </p>
                    </div>
                )}

                {decision.price_gap_percent !== undefined && (
                    <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Gap vs target</p>
                        <p
                            className={`text-xl font-semibold ${
                                decision.price_gap_percent > 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-green-600 dark:text-green-400"
                            }`}
                        >
                            {formatPct(decision.price_gap_percent, { sign: true })}
                        </p>
                    </div>
                )}

                {decision.current_price_per_sqm !== undefined && (
                    <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">€/m²</p>
                        <p className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
                            {formatPrice(decision.current_price_per_sqm)}
                        </p>
                    </div>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <FreshnessChip status={decision.freshness_status} />
                    <StageChip stage={decision.stage} />
                    <PriorityChip level={decision.priority_level} />
                </div>
            </div>

            {/* Row 2: change summary and deal thesis */}
            {(latest_change_summary !== "" || decision.deal_thesis_summary) && (
                <div className="mt-3 flex flex-col gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    {latest_change_summary !== "" && (
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            📡 {latest_change_summary}
                        </p>
                    )}
                    {decision.deal_thesis_summary && (
                        <p className="italic text-sm text-zinc-500 dark:text-zinc-400">
                            {decision.deal_thesis_summary}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default DecisionStrip;
