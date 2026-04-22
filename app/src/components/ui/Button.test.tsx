import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/Button";

describe("Button", () => {
    it("renders a consistent loading state", () => {
        render(<Button isLoading loadingLabel={"Saving property"}>{"Save"}</Button>);
        const button = screen.getByRole("button", { name: /save/i });

        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("status", { name: "Saving property" })).toBeInTheDocument();
    });

    it("preserves click handling when not loading", () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>{"Run now"}</Button>);

        fireEvent.click(screen.getByRole("button", { name: "Run now" }));

        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
