/**
 * File: app/src/features/backoffice/runChangeSummary.ts
 *
 * Purpose:
 * Implements the backoffice feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Imports: @/services/properties/properties.types
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - @/services/properties/properties.types
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
 * - /app/docs/features/backoffice.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import type { PropertySnapshot } from "@/services/properties/properties.types";

/**
 * Documents the RunFieldChange type contract used by app/src/features/backoffice/runChangeSummary.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
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
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match === null) {
        return undefined;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Purpose: Executes the buildRunFieldChanges operation for app/src/features/backoffice/runChangeSummary.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
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

/**
 * Purpose: Executes the summarizeRunChanges operation for app/src/features/backoffice/runChangeSummary.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
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
