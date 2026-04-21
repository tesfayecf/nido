import type { PropsWithChildren } from "react";

import { EmptyState } from "@/components/ui/EmptyState";

interface AsyncContentProps extends PropsWithChildren {
    readonly emptyMessage: string;
    readonly errorMessage: string;
    readonly isEmpty: boolean;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly loadingMessage: string;
}

/**
 * Renders consistent loading, error, empty, and success states.
 *
 * @param props The async state flags, messages, and success content.
 * @returns The appropriate state view for a query-driven surface.
 */
export const AsyncContent = ({
    children,
    emptyMessage,
    errorMessage,
    isEmpty,
    isError,
    isLoading,
    loadingMessage,
}: AsyncContentProps): JSX.Element => {
    if (isLoading) {
        return <p className={"state-message state-message--loading"} role={"status"}>{loadingMessage}</p>;
    }

    if (isError) {
        return <p className={"state-message state-message--error"} role={"alert"}>{errorMessage}</p>;
    }

    if (isEmpty) {
        return <EmptyState message={emptyMessage} />;
    }

    return <>{children}</>;
};
