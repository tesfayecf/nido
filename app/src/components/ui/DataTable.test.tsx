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
