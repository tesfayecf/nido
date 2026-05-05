/**
 * File: app/src/features/properties/propertyTableState.test.ts
 *
 * Purpose:
 * Validates the documented behavior of propertyTableState and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
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
import { describe, expect, it } from "vitest";

import {
    createDefaultPropertiesTableState,
    readPropertiesTableState,
    writePropertiesTableState,
} from "@/features/properties/propertyTableState";

describe("propertyTableState", () => {
    it("persists visible state in local storage", () => {
        const storageKey = "property-table-state-test";
        const state = createDefaultPropertiesTableState(["property", "price"]);

        writePropertiesTableState(storageKey, {
            ...state,
            hiddenColumnIds: ["price"],
            widths: { property: 320 },
        });

        expect(readPropertiesTableState(storageKey, ["property", "price"])).toEqual(expect.objectContaining({
            hiddenColumnIds: ["price"],
            widths: { property: 320 },
        }));
    });

    it("restores missing columns when the schema changes", () => {
        window.localStorage.setItem("property-table-schema-test", JSON.stringify({
            hiddenColumnIds: [],
            orderedColumnIds: ["price"],
            widths: {},
        }));

        expect(readPropertiesTableState("property-table-schema-test", ["property", "price"]).orderedColumnIds).toEqual(["price", "property"]);
    });
});
