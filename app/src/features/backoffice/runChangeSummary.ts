import type { PropertySnapshot } from "@/services/properties/properties.types";

export interface RunFieldChange {
    readonly absoluteDelta?: number;
    readonly currentValue: string;
    readonly direction: "down" | "none" | "text" | "up";
    readonly field: string;
    readonly percentageDelta?: number;
    readonly previousValue: string;
    readonly significant: boolean;
}

const IMPORTANT_FIELDS = ["price", "availability", "status", "title", "location"];

const parseComparableNumber = (value: string): number | undefined => {
    const digits = value.replace(/[^0-9.-]/g, "");
    if (digits.trim() === "" || digits === "-" || digits === "." || digits === "-.") {
        return undefined;
    }

    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildRunFieldChanges = (
    current: PropertySnapshot | undefined,
    previous: PropertySnapshot | undefined,
): RunFieldChange[] => {
    const previousValues = previous?.values ?? {};
    const currentValues = current?.values ?? {};
    const names = new Set<string>([...Object.keys(previousValues), ...Object.keys(currentValues)]);

    return [...names].map((field) => {
        const previousValue = previousValues[field] ?? "—";
        const currentValue = currentValues[field] ?? "—";
        const previousNumber = parseComparableNumber(previousValue);
        const currentNumber = parseComparableNumber(currentValue);
        const absoluteDelta = previousNumber !== undefined && currentNumber !== undefined ? currentNumber - previousNumber : undefined;
        const percentageDelta = absoluteDelta !== undefined && previousNumber !== undefined && previousNumber !== 0
            ? (absoluteDelta / previousNumber) * 100
            : undefined;
        const changed = previousValue !== currentValue;
        const significant = percentageDelta !== undefined ? Math.abs(percentageDelta) >= 5 : changed;
        const direction: RunFieldChange["direction"] = absoluteDelta === undefined
            ? changed ? "text" : "none"
            : absoluteDelta > 0
                ? "up"
                : absoluteDelta < 0
                    ? "down"
                    : "none";

        return {
            absoluteDelta,
            currentValue,
            direction,
            field,
            percentageDelta,
            previousValue,
            significant,
        };
    }).sort((left, right) => {
        const leftPriority = IMPORTANT_FIELDS.includes(left.field) ? IMPORTANT_FIELDS.indexOf(left.field) : IMPORTANT_FIELDS.length;
        const rightPriority = IMPORTANT_FIELDS.includes(right.field) ? IMPORTANT_FIELDS.indexOf(right.field) : IMPORTANT_FIELDS.length;
        if ((left.previousValue !== left.currentValue) !== (right.previousValue !== right.currentValue)) {
            return left.previousValue !== left.currentValue ? -1 : 1;
        }

        if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
        }

        return left.field.localeCompare(right.field);
    });
};

export const summarizeRunChanges = (changes: RunFieldChange[]): string[] => {
    return changes
        .filter((change) => change.previousValue !== change.currentValue)
        .slice(0, 4)
        .map((change) => {
            if (change.percentageDelta !== undefined) {
                return `${humanizeField(change.field)} ${change.direction === "up" ? "increased" : "decreased"} by ${Math.abs(change.percentageDelta).toFixed(1)}%.`;
            }

            return `${humanizeField(change.field)} changed from ${change.previousValue} to ${change.currentValue}.`;
        });
};

const humanizeField = (field: string): string => {
    return field.replace(/[_-]+/g, " ");
};
