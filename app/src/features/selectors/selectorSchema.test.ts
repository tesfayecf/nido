/**
 * File: app/src/features/selectors/selectorSchema.test.ts
 *
 * Purpose:
 * Validates the documented behavior of selectorSchema and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: vitest, @/services/properties/properties.types
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - vitest
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
 * - /app/docs/features/selectors.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { describe, expect, it } from "vitest";

import {
    buildFieldSelectorSignature,
    draftToSelector,
    getFieldMappingState,
    selectorToDraft,
    validateSelectorDrafts,
} from "@/features/selectors/selectorSchema";
import type { FieldSelector } from "@/services/properties/properties.types";

const templateField: FieldSelector = {
    extraction_mode: "text",
    field_role: "tracked",
    name: "price",
    required: true,
    selector_type: "css",
    selector_value: ".price",
    text_mode: "innerText",
};

describe("field mapping state model", () => {
    it("transitions from matched to overridden and back to matched", () => {
        const matchedDraft = {
            ...selectorToDraft({
                ...templateField,
                template_field_name: "price",
                template_signature: buildFieldSelectorSignature(templateField),
            }),
            templateFieldName: "price",
            templateSignature: buildFieldSelectorSignature(templateField),
        };

        expect(getFieldMappingState(matchedDraft, templateField, "Listing template").state).toBe("matched");

        const overriddenDraft = { ...matchedDraft, propertyOverride: true };
        expect(getFieldMappingState(overriddenDraft, templateField, "Listing template").state).toBe("overridden");

        const revertedDraft = {
            ...selectorToDraft({
                ...templateField,
                template_field_name: "price",
                template_signature: buildFieldSelectorSignature(templateField),
            }),
            templateFieldName: "price",
            templateSignature: buildFieldSelectorSignature(templateField),
        };
        expect(getFieldMappingState(revertedDraft, templateField, "Listing template").state).toBe("matched");
    });

    it("marks template changes as stale", () => {
        const draft = {
            ...selectorToDraft({
                ...templateField,
                template_field_name: "price",
                template_signature: buildFieldSelectorSignature(templateField),
            }),
            templateFieldName: "price",
            templateSignature: buildFieldSelectorSignature(templateField),
        };
        const changedTemplate = { ...templateField, selector_value: ".price-updated" };

        expect(getFieldMappingState(draft, changedTemplate, "Listing template").state).toBe("stale");
    });

    it("prevents invalid mappings through selector validation", () => {
        const invalid = {
            ...selectorToDraft(templateField),
            attribute: "",
            extractionMode: "attribute" as const,
            name: "price",
            selectorValue: "",
        };

        const payload = draftToSelector(invalid);
        expect(payload.selector_value).toBe("");
        expect(payload.extraction_mode).toBe("attribute");
        expect(validateSelectorDrafts([invalid])).toEqual([
            'Field "price" needs a primary selector.',
            'Field "price" needs an attribute name.',
        ]);
    });
});
