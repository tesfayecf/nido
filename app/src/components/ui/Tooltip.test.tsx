import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "@/components/ui/Tooltip";

describe("Tooltip", () => {
    it("associates tooltip content with an interactive trigger without adding an extra tab stop", () => {
        const { container } = render(
            <Tooltip content={"Retry details"}>
                <button type={"button"}>{"Run now"}</button>
            </Tooltip>,
        );

        const trigger = screen.getByRole("button", { name: "Run now" });
        const tooltip = screen.getByRole("tooltip");

        expect(trigger).toHaveAttribute("aria-describedby", tooltip.getAttribute("id"));
        expect(container.querySelector('.tooltip__trigger[tabindex="0"]')).toBeNull();
    });

    it("creates a focusable wrapper when the child is not already an element", () => {
        render(<Tooltip content={"More context"}>{"Status"}</Tooltip>);

        const tooltip = screen.getByRole("tooltip");
        const wrapper = document.querySelector<HTMLElement>(".tooltip__trigger");

        expect(wrapper).not.toBeNull();
        expect(wrapper).toHaveAttribute("tabindex", "0");
        expect(wrapper).toHaveAttribute("aria-describedby", tooltip.getAttribute("id"));
    });
});