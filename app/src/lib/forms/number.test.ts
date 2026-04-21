import { describe, expect, it } from "vitest";

import { parseOptionalNonNegativeInteger, readNonNegativeNumber } from "@/lib/forms/number";

describe("number helpers", () => {
    it("returns a fallback for invalid non-negative numbers", () => {
        expect(readNonNegativeNumber("42", 0)).toBe(42);
        expect(readNonNegativeNumber("-1", 8)).toBe(8);
        expect(readNonNegativeNumber("NaN", 8)).toBe(8);
    });

    it("parses optional non-negative integers safely", () => {
        expect(parseOptionalNonNegativeInteger("")).toBeUndefined();
        expect(parseOptionalNonNegativeInteger("120")).toBe(120);
        expect(parseOptionalNonNegativeInteger("-5")).toBeUndefined();
        expect(parseOptionalNonNegativeInteger("12.5")).toBeUndefined();
        expect(parseOptionalNonNegativeInteger("1e2")).toBe(100);
    });
});