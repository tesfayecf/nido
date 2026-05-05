/**
 * File: app/src/components/ui/Select.tsx
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
 * - Imports: react, @/lib/ui/classNames, @/components/ui/Input
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/lib/ui/classNames
 * - @/components/ui/Input
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
import type { ReactNode, SelectHTMLAttributes } from "react";

import { classNames } from "@/lib/ui/classNames";

import type { ControlSize } from "@/components/ui/Input";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
    readonly className?: string;
    readonly invalid?: boolean;
    readonly size?: ControlSize;
    readonly suffix?: ReactNode;
}

const sizeClassNames: Record<ControlSize, string> = {
    large: "field__control--large",
    medium: "field__control--medium",
    small: "field__control--small",
};

/**
 * Purpose: Renders the Select UI boundary documented for app/src/components/ui/Select.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const Select = ({
    children,
    className,
    disabled = false,
    invalid = false,
    size = "medium",
    suffix,
    ...restProps
}: SelectProps): JSX.Element => {
    return (
        <div
            className={classNames(
                "input-control",
                "input-control--select",
                sizeClassNames[size],
                invalid && "input-control--error",
                disabled && "input-control--disabled",
                className,
            )}
        >
            <select {...restProps} className={"input-control__input input-control__input--select"} disabled={disabled}>
                {children}
            </select>
            <span className={"input-control__suffix"} aria-hidden>{suffix ?? "▾"}</span>
        </div>
    );
};
