import { DataTable } from "@/components/ui/DataTable";
import type { DataTableProps } from "@/components/ui/DataTable";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

interface QueryDataTableProps<TItem> extends DataTableProps<TItem> {
    readonly errorMessage: string;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly loadingMessage: string;
}

export const QueryDataTable = <TItem,>({
    errorMessage,
    isError,
    isLoading,
    loadingMessage,
    ...dataTableProps
}: QueryDataTableProps<TItem>): JSX.Element => {
    if (isLoading) {
        return <p className={"state-message state-message--loading"}>{loadingMessage}</p>;
    }

    if (isError) {
        return <ErrorBanner>{errorMessage}</ErrorBanner>;
    }

    return <DataTable {...dataTableProps} />;
};
