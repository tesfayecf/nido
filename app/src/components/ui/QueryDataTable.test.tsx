/**
 * File: app/src/components/ui/QueryDataTable.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of QueryDataTable and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/ui/QueryDataTable
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/ui/QueryDataTable
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
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QueryDataTable } from "@/components/ui/QueryDataTable";

interface Row {
    readonly id: string;
}

const columns = [
    {
        cell: (item: Row) => item.id,
        header: "Row",
        id: "id",
    },
];

describe("QueryDataTable", () => {
    it("shows loading and error states before rendering the table", () => {
        const { rerender } = render(
            <QueryDataTable<Row>
                columns={columns}
                emptyMessage={"No rows"}
                errorMessage={"Could not load rows."}
                getRowId={(item) => item.id}
                isError={false}
                isLoading
                items={[{ id: "row-1" }]}
                loadingMessage={"Loading rows..."}
            />,
        );

        expect(screen.getByText("Loading rows...")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
        expect(screen.getAllByRole("row")).toHaveLength(6);

        rerender(
            <QueryDataTable<Row>
                columns={columns}
                emptyMessage={"No rows"}
                errorMessage={"Could not load rows."}
                getRowId={(item) => item.id}
                isError
                isLoading={false}
                items={[{ id: "row-1" }]}
                loadingMessage={"Loading rows..."}
            />,
        );

        expect(screen.getByRole("alert")).toHaveTextContent("Could not load rows.");

        rerender(
            <QueryDataTable<Row>
                columns={columns}
                emptyMessage={"No rows"}
                errorMessage={"Could not load rows."}
                getRowId={(item) => item.id}
                isError={false}
                isLoading={false}
                items={[{ id: "row-1" }]}
                loadingMessage={"Loading rows..."}
            />,
        );

        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getByText("row-1")).toBeInTheDocument();
    });
});
