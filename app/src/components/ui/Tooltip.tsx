/**
 * File: app/src/components/ui/Tooltip.tsx
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
 * - Imports: react, react, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/lib/ui/classNames
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
import { Children, Fragment, cloneElement, isValidElement, useId } from "react";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";

import { classNames } from "@/lib/ui/classNames";

interface TooltipProps extends PropsWithChildren {
    readonly className?: string;
    readonly content: ReactNode;
}

interface TooltipTriggerProps {
    readonly "aria-describedby"?: string;
}

/**
 * Purpose: Renders the Tooltip UI boundary documented for app/src/components/ui/Tooltip.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const Tooltip = ({ children, className, content }: TooltipProps): JSX.Element => {
    const tooltipId = useId();
    const childItems = Children.toArray(children);
    const singleChild = childItems.length === 1 ? childItems[0] : null;
    const canCloneChild = isValidElement<TooltipTriggerProps>(singleChild) && singleChild.type !== Fragment;
    const triggerContent = canCloneChild
        ? cloneElement(singleChild as ReactElement<TooltipTriggerProps>, {
            "aria-describedby": appendAriaDescription(singleChild.props["aria-describedby"], tooltipId),
        })
        : children;

    return (
        <span className={classNames("tooltip", className)}>
            {canCloneChild ? (
                <span className={"tooltip__trigger"}>{triggerContent}</span>
            ) : (
                <span aria-describedby={tooltipId} className={"tooltip__trigger"} tabIndex={0}>{triggerContent}</span>
            )}
            <span className={"tooltip__content"} id={tooltipId} role={"tooltip"}>{content}</span>
        </span>
    );
};

const appendAriaDescription = (currentValue: string | undefined, nextValue: string): string => {
    if (currentValue === undefined || currentValue.trim() === "") {
        return nextValue;
    }

    const tokens = currentValue.split(/\s+/);
    return tokens.includes(nextValue) ? currentValue : `${currentValue} ${nextValue}`;
};
