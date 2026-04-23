import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TagBadge } from "@/components/tags/TagBadge";

describe("TagBadge", () => {
    it("renders tag name with color", () => {
        const tag = {
            color: "#3b82f6",
            created_at: "2025-01-01",
            id: "tag1",
            name: "High Priority",
            updated_at: "2025-01-01",
        };

        render(<TagBadge tag={tag} />);

        expect(screen.getByLabelText("Tag: High Priority")).toBeInTheDocument();
        expect(screen.getByText("High Priority")).toBeInTheDocument();
    });

    it("renders tag with fallback color when color is empty", () => {
        const tag = {
            color: "",
            created_at: "2025-01-01",
            id: "tag2",
            name: "No Color",
            updated_at: "2025-01-01",
        };

        render(<TagBadge tag={tag} />);

        expect(screen.getByLabelText("Tag: No Color")).toBeInTheDocument();
        expect(screen.getByText("No Color")).toBeInTheDocument();
    });
});
