import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

describe("Field", () => {
    it("keeps helper copy hidden until the user requests it", () => {
        render(
            <Field hint={"Enter a stable locale such as en-IE or es-ES."} label={"Display locale"}>
                <Input type={"text"} />
            </Field>,
        );

        expect(screen.getByLabelText("Display locale")).toBeInTheDocument();
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Show help for Display locale" }));

        expect(screen.getByRole("tooltip")).toHaveTextContent("Enter a stable locale such as en-IE or es-ES.");
    });
});
