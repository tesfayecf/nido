/**
 * File: app/src/components/ui/Button.tsx
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
/* eslint-disable @typescript-eslint/naming-convention */
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { classNames } from "@/lib/ui/classNames";

/**
 * Documents the ButtonSize type contract used by app/src/components/ui/Button.tsx.
 * Keep this contract synchronized with service payloads, component props, and tests that consume it.
 */
export type ButtonSize = "large" | "medium" | "small";
/**
 * Documents the ButtonVariant type contract used by app/src/components/ui/Button.tsx.
 * Keep this contract synchronized with service payloads, component props, and tests that consume it.
 */
export type ButtonVariant = "destructive" | "ghost" | "primary" | "secondary";

type ButtonProps<TElement extends ElementType> = {
    readonly as?: TElement;
    readonly children: ReactNode;
    readonly className?: string;
    readonly fullWidth?: boolean;
    readonly iconAfter?: ReactNode;
    readonly iconBefore?: ReactNode;
    readonly isLoading?: boolean;
    readonly loadingLabel?: string;
    readonly size?: ButtonSize;
    readonly variant?: ButtonVariant;
} & Omit<ComponentPropsWithoutRef<TElement>, "as" | "children" | "className">;

const sizeClassNames: Record<ButtonSize, string> = {
    large: "button--large",
    medium: "button--medium",
    small: "button--small",
};

const variantClassNames: Record<ButtonVariant, string> = {
    destructive: "button--destructive",
    ghost: "button--ghost",
    primary: "button--primary",
    secondary: "button--secondary",
};

/**
 * Purpose: Renders the Button UI boundary documented for app/src/components/ui/Button.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const Button = <TElement extends ElementType = "button">({
    as,
    children,
    className,
    disabled,
    fullWidth = false,
    iconAfter,
    iconBefore,
    isLoading = false,
    loadingLabel,
    size = "medium",
    variant = "primary",
    ...restProps
}: ButtonProps<TElement>): JSX.Element => {
    const Component = as ?? "button";
    const componentProps = { ...restProps } as ComponentPropsWithoutRef<TElement> & {
        disabled?: boolean;
        type?: "button" | "reset" | "submit";
    };

    if (Component === "button" && componentProps.type === undefined) {
        componentProps.type = "button";
    }

    if (Component === "button") {
        componentProps.disabled = disabled ?? isLoading;
    }

    return (
        <Component
            {...componentProps}
            aria-busy={isLoading || undefined}
            aria-disabled={Component !== "button" && (disabled ?? isLoading) ? true : undefined}
            className={classNames(
                "button",
                variantClassNames[variant],
                sizeClassNames[size],
                fullWidth && "button--full-width",
                isLoading && "button--loading",
                className,
            )}
            data-loading={isLoading ? "true" : undefined}
        >
            {isLoading ? <InlineSpinner className={"button__spinner"} label={loadingLabel ?? "Loading"} /> : iconBefore}
            <span className={"button__label"}>{children}</span>
            {!isLoading ? iconAfter : null}
        </Component>
    );
};
