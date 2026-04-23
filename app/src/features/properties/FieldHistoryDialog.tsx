import { useMemo } from "react";

import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SparklineChart } from "@/components/ui/SparklineChart";
import type { PropertySnapshot } from "@/services/properties/properties.types";
import { formatDateTime } from "@/lib/format/date";

interface FieldHistoryDialogProps {
    readonly fieldName: string;
    readonly onOpenChange: (open: boolean) => void;
    readonly open: boolean;
    readonly snapshots: PropertySnapshot[];
}

interface HistoryPoint {
    readonly observedAt: string;
    readonly raw: string;
    readonly value: number;
}

const NUMERIC_PATTERN = /-?\d[\d.,]*/u;

const parseNumeric = (raw: string): number | undefined => {
    const match = NUMERIC_PATTERN.exec(raw);
    if (match === null) {
        return undefined;
    }

    // Drop thousands separators (e.g. "1,234,567") then normalize a single
    // remaining comma as a decimal separator for European locales.
    const cleaned = match[0].replace(/,(?=\d{3}(?!\d))/gu, "").replace(",", ".");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Renders a modal chart of a single field's historical values across runs.
 * Falls back to a textual list when no snapshot can be parsed numerically.
 */
export const FieldHistoryDialog = ({ fieldName, onOpenChange, open, snapshots }: FieldHistoryDialogProps): JSX.Element => {
    const series = useMemo<HistoryPoint[]>(() => {
        return snapshots
            .slice()
            .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
            .map((snapshot) => {
                const raw = snapshot.values?.[fieldName] ?? "";
                const parsed = parseNumeric(raw);
                return parsed === undefined
                    ? null
                    : { observedAt: snapshot.observed_at, raw, value: parsed };
            })
            .filter((point): point is HistoryPoint => point !== null);
    }, [fieldName, snapshots]);

    const textualHistory = useMemo(() => {
        return snapshots
            .slice()
            .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
            .map((snapshot) => ({
                id: snapshot.id,
                observedAt: snapshot.observed_at,
                value: snapshot.values?.[fieldName] ?? "",
            }))
            .filter((item) => item.value !== "");
    }, [fieldName, snapshots]);

    const hasNumericSeries = series.length >= 2;
    const minValue = hasNumericSeries ? Math.min(...series.map((point) => point.value)) : 0;
    const maxValue = hasNumericSeries ? Math.max(...series.map((point) => point.value)) : 0;
    const latestValue = hasNumericSeries ? series[series.length - 1] : undefined;

    return (
        <Dialog
            description={"Historical values for this field across recorded runs."}
            onOpenChange={onOpenChange}
            open={open}
            title={`Field history · ${fieldName}`}
        >
            {hasNumericSeries ? (
                <div className={"field-history"}>
                    <div className={"field-history__summary"}>
                        <div>
                            <p className={"field-history__label"}>{"Latest"}</p>
                            <strong className={"field-history__value"}>{latestValue?.raw}</strong>
                        </div>
                        <div>
                            <p className={"field-history__label"}>{"Min · Max"}</p>
                            <strong className={"field-history__value"}>{`${minValue} · ${maxValue}`}</strong>
                        </div>
                        <div>
                            <p className={"field-history__label"}>{"Points"}</p>
                            <strong className={"field-history__value"}>{`${series.length}`}</strong>
                        </div>
                    </div>
                    <SparklineChart hero points={series.map((point) => point.value)} />
                </div>
            ) : null}

            {!hasNumericSeries && textualHistory.length === 0 ? 
                <EmptyState message={"No values have been captured for this field yet."} />
                : null}

            {textualHistory.length > 0 ? (
                <ol className={"field-history__list"}>
                    {textualHistory.map((entry) => (
                        <li className={"field-history__entry"} key={entry.id}>
                            <span className={"field-history__entry-time"}>{formatDateTime(entry.observedAt)}</span>
                            <code className={"field-history__entry-value"}>{entry.value}</code>
                        </li>
                    ))}
                </ol>
            ) : null}
        </Dialog>
    );
};
