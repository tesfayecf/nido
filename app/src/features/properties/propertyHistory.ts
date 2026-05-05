/**
 * File: app/src/features/properties/propertyHistory.ts
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import type { PropertySnapshot } from "@/services/properties/properties.types";

/**
 * Documents the PriceHistoryPoint type contract used by app/src/features/properties/propertyHistory.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PriceHistoryPoint {
    readonly label: string;
    readonly observedAt: string;
    readonly value: number;
}

const NUMERIC_REGEX = /-?\d[\d.,]*/u;

/**
 * Purpose: Executes the parseSnapshotNumber operation for app/src/features/properties/propertyHistory.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const parseSnapshotNumber = (raw: string | undefined): number | undefined => {
    if (raw === undefined) {
        return undefined;
    }

    const trimmed = raw.trim();
    if (trimmed === "") {
        return undefined;
    }

    const match = NUMERIC_REGEX.exec(trimmed);
    if (match === null) {
        return undefined;
    }

    // Normalize both "123,456.78" and "123.456,78"-style inputs into a parseable decimal string.
    const cleaned = match[0].replace(/,(?=\d{3}(?!\d))/gu, "").replace(",", ".");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Purpose: Executes the buildPriceHistoryPoints operation for app/src/features/properties/propertyHistory.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const buildPriceHistoryPoints = (snapshots: readonly PropertySnapshot[]): PriceHistoryPoint[] => {
    return snapshots
        .slice()
        .sort((left, right) => left.observed_at.localeCompare(right.observed_at))
        .map((snapshot) => {
            const value = parseSnapshotNumber(snapshot.values.price ?? snapshot.values.total_price);
            if (value === undefined) {
                return null;
            }

            return {
                label: new Date(snapshot.observed_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }),
                observedAt: snapshot.observed_at,
                value,
            } satisfies PriceHistoryPoint;
        })
        .filter((point): point is PriceHistoryPoint => point !== null);
};
