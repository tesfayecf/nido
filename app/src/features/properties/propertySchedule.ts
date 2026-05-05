/**
 * File: app/src/features/properties/propertySchedule.ts
 *
 * Purpose:
 * Implements the properties feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
export type DurationUnit = "hours" | "minutes" | "seconds";

/**
 * Documents the DurationDraft type contract used by app/src/features/properties/propertySchedule.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface DurationDraft {
    readonly unit: DurationUnit;
    readonly value: string;
}

const durationUnitSeconds: Record<DurationUnit, number> = {
    hours: 3600,
    minutes: 60,
    seconds: 1,
};

const unitLabels: Record<DurationUnit, string> = {
    hours: "hour",
    minutes: "minute",
    seconds: "second",
};

export const SCHEDULE_PRESETS: readonly DurationDraft[] = [
    { unit: "minutes", value: "1" },
    { unit: "minutes", value: "5" },
    { unit: "minutes", value: "15" },
    { unit: "hours", value: "1" },
];

/**
 * Purpose: Executes the durationDraftFromSeconds operation for app/src/features/properties/propertySchedule.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const durationDraftFromSeconds = (seconds?: number): DurationDraft => {
    if (seconds === undefined || seconds <= 0) {
        return { unit: "hours", value: "1" };
    }

    if (seconds % durationUnitSeconds.hours === 0) {
        return { unit: "hours", value: String(seconds / durationUnitSeconds.hours) };
    }

    if (seconds % durationUnitSeconds.minutes === 0) {
        return { unit: "minutes", value: String(seconds / durationUnitSeconds.minutes) };
    }

    return { unit: "seconds", value: String(seconds) };
};

/**
 * Purpose: Executes the durationDraftToSeconds operation for app/src/features/properties/propertySchedule.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const durationDraftToSeconds = (value: string, unit: DurationUnit): number | null => {
    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        return null;
    }

    return parsedValue * durationUnitSeconds[unit];
};

/**
 * Purpose: Executes the formatDurationFromSeconds operation for app/src/features/properties/propertySchedule.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const formatDurationFromSeconds = (seconds?: number): string => {
    if (seconds === undefined || seconds <= 0) {
        return "Manual only";
    }

    const { unit, value } = durationDraftFromSeconds(seconds);
    const parsedValue = Number(value);
    const label = unitLabels[unit];
    return `${parsedValue} ${label}${parsedValue === 1 ? "" : "s"}`;
};
