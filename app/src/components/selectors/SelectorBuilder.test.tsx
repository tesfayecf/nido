import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { createDefaultSelectorDrafts } from "@/features/selectors/selectorSchema";

describe("SelectorBuilder", () => {
    it("opens a help popup with selector guidance", () => {
        render(<SelectorBuilder fields={createDefaultSelectorDrafts()} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "How to use" }));

        expect(screen.getByRole("dialog", { name: "How to use the selector tool" })).toBeInTheDocument();
        expect(screen.getByText("Recommended workflow")).toBeInTheDocument();
        expect(screen.getByText(/Start with a simple CSS selector/i)).toBeInTheDocument();
        expect(screen.getByText(/Use CSS first/i)).toBeInTheDocument();
        expect(screen.getByText(/If Preview says no selector matched/i)).toBeInTheDocument();
    });

    it("closes the help popup", () => {
        render(<SelectorBuilder fields={createDefaultSelectorDrafts()} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "How to use" }));
        fireEvent.click(screen.getByRole("button", { name: "Got it" }));

        expect(screen.queryByRole("dialog", { name: "How to use the selector tool" })).not.toBeInTheDocument();
    });
});
