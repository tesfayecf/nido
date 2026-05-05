/**
 * File: app/src/components/ui/KeyValueGrid.tsx
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
 * - Imports: react, @/lib/ui/classNames
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
/* eslint-disable react/jsx-props-no-spreading */
import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";

import { classNames } from "@/lib/ui/classNames";

interface KeyValueGridProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
    readonly className?: string;
    readonly compact?: boolean;
}

interface KeyValuePairProps {
    readonly className?: string;
    readonly label: ReactNode;
    readonly value: ReactNode;
}

/**
 * Purpose: Renders the KeyValueGrid UI boundary documented for app/src/components/ui/KeyValueGrid.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const KeyValueGrid = ({ children, className, compact = false, ...restProps }: KeyValueGridProps): JSX.Element => {
    return (
        <div
            {...restProps}
            className={classNames("key-value-grid", compact && "key-value-grid--compact", className)}
        >
            {children}
        </div>
    );
};

/**
 * Purpose: Renders the KeyValuePair UI boundary documented for app/src/components/ui/KeyValueGrid.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const KeyValuePair = ({ className, label, value }: KeyValuePairProps): JSX.Element => {
    return (
        <div className={className}>
            <span className={"key-value-grid__label"}>{label}</span>
            <strong className={"key-value-grid__value"}>{value}</strong>
        </div>
    );
};
