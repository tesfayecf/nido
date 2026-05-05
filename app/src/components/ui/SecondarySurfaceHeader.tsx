/**
 * File: app/src/components/ui/SecondarySurfaceHeader.tsx
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
 * - Imports: react, @/components/ui/PageCard
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/PageCard
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

import { PageCard } from "@/components/ui/PageCard";

/**
 * Purpose: Renders the SecondarySurfaceSummaryItem UI boundary documented for app/src/components/ui/SecondarySurfaceHeader.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export interface SecondarySurfaceSummaryItem {
    readonly context: ReactNode;
    readonly label: string;
    readonly value: ReactNode;
}

interface SecondarySurfaceHeaderProps extends PropsWithChildren {
    readonly action?: ReactNode;
    readonly description?: string;
    readonly summaryAriaLabel: string;
    readonly summaryItems: readonly SecondarySurfaceSummaryItem[];
    readonly title: string;
}

/**
 * Purpose: Renders the SecondarySurfaceHeader UI boundary documented for app/src/components/ui/SecondarySurfaceHeader.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const SecondarySurfaceHeader = ({
    action,
    children,
    description,
    summaryAriaLabel,
    summaryItems,
    title,
}: SecondarySurfaceHeaderProps): JSX.Element => {
    return (
        <PageCard action={action} description={description} title={title}>
            <section aria-label={summaryAriaLabel} className={"management-surface__summary"}>
                {summaryItems.map((item) => (
                    <article className={"management-surface__summary-item"} key={item.label}>
                        <span className={"management-surface__summary-label"}>{item.label}</span>
                        <strong className={"management-surface__summary-value"}>{item.value}</strong>
                        <p className={"management-surface__summary-context"}>{item.context}</p>
                    </article>
                ))}
            </section>
            {children !== undefined ? <div className={"management-surface__controls"}>{children}</div> : null}
        </PageCard>
    );
};
