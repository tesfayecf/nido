/**
 * File: app/src/components/ui/FormGrid.tsx
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
import type { FormHTMLAttributes, HTMLAttributes, PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

/**
 * Documents the FormGridVariant type contract used by app/src/components/ui/FormGrid.tsx.
 * Keep this contract synchronized with service payloads, component props, and tests that consume it.
 */
export type FormGridVariant = "default" | "inline" | "two-column";

interface FormGridProps extends PropsWithChildren, Omit<FormHTMLAttributes<HTMLFormElement>, "className"> {
    readonly as?: "div" | "form";
    readonly className?: string;
    readonly variant?: FormGridVariant;
}

const variantClassNames: Record<FormGridVariant, string | undefined> = {
    default: undefined,
    inline: "form-grid--inline",
    "two-column": "form-grid--two-column",
};

/**
 * Purpose: Renders the FormGrid UI boundary documented for app/src/components/ui/FormGrid.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const FormGrid = ({
    as = "form",
    children,
    className,
    variant = "default",
    ...restProps
}: FormGridProps): JSX.Element => {
    const resolvedClassName = classNames("form-grid", variantClassNames[variant], className);

    if (as === "div") {
        return <div {...restProps as HTMLAttributes<HTMLDivElement>} className={resolvedClassName}>{children}</div>;
    }

    return <form {...restProps} className={resolvedClassName}>{children}</form>;
};
