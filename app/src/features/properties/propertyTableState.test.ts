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
