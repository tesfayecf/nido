/**
 * File: app/src/components/ui/AsyncContent.tsx
 *
 * Purpose:
 * Provides a reusable design-system UI building block shared across feature workflows.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @/components/ui/EmptyState
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/EmptyState
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
