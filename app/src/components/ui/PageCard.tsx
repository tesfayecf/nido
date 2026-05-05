/**
 * File: app/src/components/ui/PageCard.tsx
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
 * - Imports: react, @/components/ui/ContextualHelp
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/ContextualHelp
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
import type { PropsWithChildren, ReactNode } from "react";

import { ContextualHelp } from "@/components/ui/ContextualHelp";

interface PageCardProps extends PropsWithChildren {
    readonly action?: ReactNode;
    readonly description?: string;
    readonly title: string;
    readonly titleId?: string;
}

/**
 * Renders a reusable dense panel used throughout the first iteration.
 *
 * @param props The card title, optional description, optional action, and content.
 * @returns A styled information panel.
 */
export const PageCard = ({ action, children, description, title, titleId }: PageCardProps): JSX.Element => {
    return (
        <section className={"page-card"}>
            <header className={"page-card__header"}>
                <div className={"page-card__heading"}>
                    <div className={"page-card__title-row"}>
                        <h2 className={"page-card__title"} id={titleId}>{title}</h2>
                        {description !== undefined ? <ContextualHelp content={description} title={title} /> : null}
                    </div>
                </div>
                {action !== undefined ? <div className={"page-card__action"}>{action}</div> : null}
            </header>
            <div className={"page-card__body"}>{children}</div>
        </section>
    );
};
