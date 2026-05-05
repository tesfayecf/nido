/**
 * File: app/src/components/ui/Input.tsx
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
 * - Imports: react, @/components/ui/InlineSpinner, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/InlineSpinner
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
import type { InputHTMLAttributes, ReactNode } from "react";

import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { classNames } from "@/lib/ui/classNames";

/**
 * Documents the ControlSize type contract used by app/src/components/ui/Input.tsx.
 * Keep this contract synchronized with service payloads, component props, and tests that consume it.
 */
export type ControlSize = "large" | "medium" | "small";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size"> {
    readonly className?: string;
    readonly invalid?: boolean;
    readonly loading?: boolean;
    readonly prefix?: ReactNode;
    readonly size?: ControlSize;
    readonly suffix?: ReactNode;
}

const sizeClassNames: Record<ControlSize, string> = {
    large: "field__control--large",
    medium: "field__control--medium",
    small: "field__control--small",
};

/**
 * Purpose: Renders the Input UI boundary documented for app/src/components/ui/Input.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const Input = ({
    className,
    disabled = false,
    invalid = false,
    loading = false,
    prefix,
    size = "medium",
    suffix,
    ...restProps
}: InputProps): JSX.Element => {
    const hasChrome = prefix !== undefined || suffix !== undefined || loading;
    const controlClassName = classNames(
        "field__control",
        sizeClassNames[size],
        invalid && "field__control--error",
        !hasChrome && className,
    );

    if (!hasChrome) {
        return <input {...restProps} className={controlClassName} disabled={disabled || loading} />;
    }

    return (
        <div
            className={classNames(
                "input-control",
                sizeClassNames[size],
                invalid && "input-control--error",
                (disabled || loading) && "input-control--disabled",
                className,
            )}
        >
            {prefix !== undefined ? <span className={"input-control__prefix"}>{prefix}</span> : null}
            <input {...restProps} className={"input-control__input"} disabled={disabled || loading} />
            {loading ? <InlineSpinner className={"input-control__suffix"} /> : null}
            {!loading && suffix !== undefined ? <span className={"input-control__suffix"}>{suffix}</span> : null}
        </div>
    );
};
