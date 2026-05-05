/**
 * File: app/src/components/ui/DataTable.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of DataTable and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, vitest, @/components/ui/DataTable
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - vitest
 * - @/components/ui/DataTable
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

import { DataTable } from "@/components/ui/DataTable";

interface Row {
    readonly id: string;
    readonly price: number;
}

describe("DataTable", () => {
    it("sorts rows with shared column definitions", () => {
        render(
            <DataTable<Row>
                columns={[
                    {
                        cell: (item) => item.id,
                        header: "Listing",
                        id: "id",
                    },
                    {
                        align: "right",
                        cell: (item) => `${item.price}`,
                        header: "Price",
                        id: "price",
                        sortValue: (item) => item.price,
                    },
                ]}
                emptyMessage={"No rows"}
                getRowId={(item) => item.id}
                items={[
                    { id: "b", price: 420000 },
                    { id: "a", price: 380000 },
                ]}
                pageSize={10}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Price" }));

        const cells = screen.getAllByRole("cell");
        expect(cells[0]).toHaveTextContent("a");
        expect(cells[1]).toHaveTextContent("380000");
    });

    it("paginates large datasets and only mounts the current virtualized window", () => {
        render(
            <DataTable<Row>
                columns={[
                    {
                        cell: (item) => item.id,
                        header: "Listing",
                        id: "id",
                    },
                ]}
                emptyMessage={"No rows"}
                getRowId={(item) => item.id}
                items={Array.from({ length: 80 }, (_, index) => ({ id: `row-${index + 1}`, price: index }))}
                pageSize={50}
                pageSizeOptions={[25, 50]}
                virtualizeThreshold={10}
            />,
        );

        expect(screen.getByText("Page 1 of 2 · 80 rows")).toBeInTheDocument();
        expect(screen.queryByText("row-40")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Next" }));

        expect(screen.getByText("Page 2 of 2 · 80 rows")).toBeInTheDocument();
        expect(screen.getByText("row-51")).toBeInTheDocument();
    });
});
