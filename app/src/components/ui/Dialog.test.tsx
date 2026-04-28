import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/Dialog";

describe("Dialog", () => {
    it("closes when escape is pressed", () => {
        const handleOpenChange = vi.fn();
        render(
            <Dialog onOpenChange={handleOpenChange} open title={"Filters"}>
                <button type={"button"}>{"Focusable child"}</button>
            </Dialog>,
        );

        fireEvent.keyDown(window, { key: "Escape" });

        expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it("renders content inside an accessible dialog", () => {
        render(
            <Dialog description={"Refine results"} onOpenChange={vi.fn()} open title={"Filters"}>
                <p>{"Dialog body"}</p>
            </Dialog>,
        );

        expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
        expect(screen.getByText("Dialog body")).toBeInTheDocument();
    });

    it("focuses the requested primary target when one is provided", () => {
        render(
            <Dialog initialFocusSelector={"[data-dialog-primary='true']"} onOpenChange={vi.fn()} open title={"Confirm change"}>
                <button type={"button"}>{"Cancel"}</button>
                <button data-dialog-primary={"true"} type={"button"}>{"Confirm"}</button>
            </Dialog>,
        );

        expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    });
});
