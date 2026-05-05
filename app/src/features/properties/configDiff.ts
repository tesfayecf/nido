/**
 * File: app/src/features/properties/configDiff.ts
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
import type { FieldSelector, PropertyExtractionConfig } from "@/services/properties/properties.types";

interface ConfigFieldChange {
    readonly field: string;
    readonly next?: FieldSelector;
    readonly previous?: FieldSelector;
    readonly type: "added" | "modified" | "removed";
}

/**
 * Documents the ConfigDiffSummary type contract used by app/src/features/properties/configDiff.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface ConfigDiffSummary {
    readonly changedCount: number;
    readonly changes: ConfigFieldChange[];
}

const serializeField = (field: FieldSelector): string => {
    return JSON.stringify(field);
};

/**
 * Purpose: Executes the diffPropertyConfigs operation for app/src/features/properties/configDiff.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const diffPropertyConfigs = (
    previous: PropertyExtractionConfig | undefined,
    next: PropertyExtractionConfig | undefined,
): ConfigDiffSummary => {
    const previousByName = new Map((previous?.fields ?? []).map((field) => [field.name, field]));
    const nextByName = new Map((next?.fields ?? []).map((field) => [field.name, field]));
    const names = new Set<string>([...previousByName.keys(), ...nextByName.keys()]);
    const changes: ConfigFieldChange[] = [];

    [...names]
        .sort((left, right) => left.localeCompare(right))
        .forEach((name) => {
            const previousField = previousByName.get(name);
            const nextField = nextByName.get(name);
            if (previousField === undefined && nextField !== undefined) {
                changes.push({ field: name, next: nextField, type: "added" });
                return;
            }

            if (previousField !== undefined && nextField === undefined) {
                changes.push({ field: name, previous: previousField, type: "removed" });
                return;
            }

            if (previousField !== undefined && nextField !== undefined && serializeField(previousField) !== serializeField(nextField)) {
                changes.push({ field: name, next: nextField, previous: previousField, type: "modified" });
            }
        });

    return {
        changedCount: changes.length,
        changes,
    };
};
