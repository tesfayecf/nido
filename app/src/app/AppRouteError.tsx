/**
 * File: app/src/app/AppRouteError.tsx
 *
 * Purpose:
 * Defines the frontend behavior owned by app/AppRouteError.tsx.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react-router-dom, @/components/ui/Button, @/components/ui/PageCard, @/components/ui/PageStack
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react-router-dom
 * - @/components/ui/Button
 * - @/components/ui/PageCard
 * - @/components/ui/PageStack
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
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";

/**
 * Renders a stable fallback when a routed screen throws during rendering or loading.
 *
 * @returns The route error boundary UI.
 */
export const AppRouteError = (): JSX.Element => {
    const error = useRouteError();

    let title = "Unexpected Error";
    let description = "The requested screen could not be rendered.";
    if (isRouteErrorResponse(error)) {
        title = `${error.status} ${error.statusText}`.trim();
        description = typeof error.data === "string" && error.data.trim() !== ""
            ? error.data
            : "The route failed while loading data or rendering.";
    } else if (error instanceof Error && error.message.trim() !== "") {
        description = error.message;
    }

    return (
        <PageStack>
            <PageCard
                action={<Button as={Link} to={"/dashboard"} variant={"secondary"}>{"Back to dashboard"}</Button>}
                description={description}
                title={title}
            >
                <p className={"muted-copy"}>{"Reload the page after the underlying problem is resolved, or return to a stable route."}</p>
            </PageCard>
        </PageStack>
    );
};
