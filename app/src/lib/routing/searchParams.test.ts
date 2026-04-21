import { describe, expect, it } from "vitest";

import { readBooleanParam, readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";

describe("searchParams helpers", () => {
    it("reads typed values with fallbacks", () => {
        const params = new URLSearchParams("q=bilbao&limit=25&unread_only=true");

        expect(readStringParam(params, "q")).toBe("bilbao");
        expect(readNumberParam(params, "limit", 10)).toBe(25);
        expect(readBooleanParam(params, "unread_only", false)).toBe(true);
        expect(readNumberParam(params, "missing", 10)).toBe(10);
    });

    it("writes and deletes params predictably", () => {
        const params = new URLSearchParams();

        writeParam(params, "q", "house");
        writeParam(params, "limit", 30);
        writeParam(params, "source_id", "");

        expect(params.get("q")).toBe("house");
        expect(params.get("limit")).toBe("30");
        expect(params.has("source_id")).toBe(false);
    });
});