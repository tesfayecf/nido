/**
 * File: app/src/components/ui/Tabs.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of Tabs and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/ui/Tabs
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/ui/Tabs
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs } from "@/components/ui/Tabs";

const ITEMS = [
    { id: "overview", label: "Overview", panel: <p>{"Overview panel"}</p> },
    { id: "history", label: "History", panel: <p>{"History panel"}</p> },
    { id: "activity", label: "Activity", panel: <p>{"Activity panel"}</p> },
];

describe("Tabs", () => {
    it("supports arrow-key navigation and updates the active panel", () => {
        render(<Tabs items={ITEMS} />);

        const overviewTab = screen.getByRole("tab", { name: "Overview" });
        expect(overviewTab).toHaveAttribute("aria-selected", "true");
        expect(overviewTab).toHaveAttribute("tabindex", "0");

        fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

        const historyTab = screen.getByRole("tab", { name: "History" });
        expect(historyTab).toHaveFocus();
        expect(historyTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tabpanel", { name: "History" })).toBeVisible();

        fireEvent.keyDown(historyTab, { key: "End" });

        const activityTab = screen.getByRole("tab", { name: "Activity" });
        expect(activityTab).toHaveFocus();
        expect(activityTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tabpanel", { name: "Activity" })).toBeVisible();
    });

    it("generates unique tab and panel ids for multiple instances using the same item ids", () => {
        render(
            <>
                <Tabs items={ITEMS} />
                <Tabs defaultTabId={"history"} items={ITEMS} />
            </>,
        );

        const overviewTabs = screen.getAllByRole("tab", { name: "Overview" });
        const historyTabs = screen.getAllByRole("tab", { name: "History" });

        expect(overviewTabs[0]).not.toHaveAttribute("id", overviewTabs[1]?.getAttribute("id"));
        expect(historyTabs[0]).not.toHaveAttribute("aria-controls", historyTabs[1]?.getAttribute("aria-controls"));
    });
});