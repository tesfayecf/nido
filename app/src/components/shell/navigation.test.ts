import { describe, expect, it } from "vitest";

import { AUTHENTICATED_SECTIONS, getRouteMeta } from "@/components/shell/navigation";

describe("navigation", () => {
    it("prioritizes the dashboard ahead of the properties list", () => {
        const coreItems = AUTHENTICATED_SECTIONS[0]?.items.map((item) => item.label) ?? [];

        expect(coreItems.indexOf("Dashboard")).toBeGreaterThan(-1);
        expect(coreItems.indexOf("Properties")).toBeGreaterThan(-1);
        expect(coreItems.indexOf("Dashboard")).toBeLessThan(coreItems.indexOf("Properties"));
    });

    it("falls back to dashboard metadata for unknown routes", () => {
        expect(getRouteMeta("/unexpected")).toEqual({ section: "Core", title: "Dashboard" });
    });
});
