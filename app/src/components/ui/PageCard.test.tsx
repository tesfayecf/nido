import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageCard } from "@/components/ui/PageCard";

describe("PageCard", () => {
    it("shows preserved subtitle text in the contextual help popover on hover and hides it on leave", () => {
        render(
            <PageCard description={"Operators can review the page purpose here."} title={"Dashboard"}>
                <div>{"Body"}</div>
            </PageCard>,
        );

        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

        fireEvent.mouseEnter(screen.getByRole("button", { name: "Show help for Dashboard" }));
        expect(screen.getByRole("tooltip")).toHaveTextContent("Operators can review the page purpose here.");

        fireEvent.mouseLeave(screen.getByRole("button", { name: "Show help for Dashboard" }));
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("supports keyboard focus, escape dismissal, and only keeps one popover open at a time", () => {
        render(
            <>
                <PageCard description={"First subtitle"} title={"First title"}>
                    <div>{"First body"}</div>
                </PageCard>
                <PageCard description={"Second subtitle"} title={"Second title"}>
                    <div>{"Second body"}</div>
                </PageCard>
            </>,
        );

        const firstTrigger = screen.getByRole("button", { name: "Show help for First title" });
        const secondTrigger = screen.getByRole("button", { name: "Show help for Second title" });

        fireEvent.focus(firstTrigger);
        expect(screen.getByRole("tooltip")).toHaveTextContent("First subtitle");

        fireEvent.focus(secondTrigger);
        expect(screen.getByRole("tooltip")).toHaveTextContent("Second subtitle");
        expect(screen.getByRole("tooltip")).not.toHaveTextContent("First subtitle");

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("toggles on tap and closes when pressing outside", () => {
        render(
            <PageCard description={"Tap subtitle"} title={"Mobile title"}>
                <div>{"Body"}</div>
            </PageCard>,
        );

        const trigger = screen.getByRole("button", { name: "Show help for Mobile title" });

        fireEvent.click(trigger);
        expect(screen.getByRole("tooltip")).toHaveTextContent("Tap subtitle");

        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
});
