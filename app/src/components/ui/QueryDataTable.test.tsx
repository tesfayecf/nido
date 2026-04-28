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
