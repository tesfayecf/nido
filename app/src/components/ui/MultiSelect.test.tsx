import { useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "@/components/ui/Field";
import { MultiSelect } from "@/components/ui/MultiSelect";

const OPTIONS = [
    {
        description: "Highest urgency",
        label: <span><strong>{"Critical"}</strong>{" alerts"}</span>,
        value: "critical",
    },
    {
        description: "Informational",
        label: <span>{"Digest only"}</span>,
        value: "digest",
    },
];

const MultiSelectHarness = (): JSX.Element => {
    const [values, setValues] = useState<string[]>([]);

    return (
        <Field label={"Delivery channels"}>
            <MultiSelect onChange={setValues} options={OPTIONS} values={values} />
        </Field>
    );
};

describe("MultiSelect", () => {
    it("keeps the field label as the trigger name and supports rich labels in search and selection", () => {
        render(<MultiSelectHarness />);

        const trigger = screen.getByRole("button", { name: "Delivery channels" });
        fireEvent.click(trigger);

        fireEvent.change(screen.getByPlaceholderText("Search options"), { target: { value: "critical" } });
        fireEvent.click(screen.getByRole("option", { name: /critical alerts/i }));

        expect(screen.getByRole("button", { name: "Delivery channels" })).toHaveTextContent("Critical alerts");
    });

    it("closes on escape and returns focus to the trigger", () => {
        render(<MultiSelectHarness />);

        const trigger = screen.getByRole("button", { name: "Delivery channels" });
        fireEvent.click(trigger);
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "Escape" });

        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});