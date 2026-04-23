import { describe, expect, it } from "vitest";

import {
    durationDraftFromSeconds,
    durationDraftToSeconds,
    formatDurationFromSeconds,
} from "@/features/properties/propertySchedule";

describe("propertySchedule", () => {
    it("converts saved seconds into structured duration drafts", () => {
        expect(durationDraftFromSeconds(3600)).toEqual({ unit: "hours", value: "1" });
        expect(durationDraftFromSeconds(900)).toEqual({ unit: "minutes", value: "15" });
        expect(durationDraftFromSeconds(45)).toEqual({ unit: "seconds", value: "45" });
    });

    it("converts structured duration drafts back into seconds", () => {
        expect(durationDraftToSeconds("5", "minutes")).toBe(300);
        expect(durationDraftToSeconds("2", "hours")).toBe(7200);
        expect(durationDraftToSeconds("", "minutes")).toBeNull();
    });

    it("formats scheduling summaries for the UI", () => {
        expect(formatDurationFromSeconds(300)).toBe("5 minutes");
        expect(formatDurationFromSeconds(undefined)).toBe("Manual only");
    });
});
