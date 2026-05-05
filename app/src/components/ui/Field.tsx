/**
 * File: app/src/components/ui/Field.tsx
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
 * - Imports: react, @/components/ui/ContextualHelp, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/ContextualHelp
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
import { cloneElement, isValidElement, useId } from "react";
import type { HTMLAttributes, LabelHTMLAttributes, PropsWithChildren, ReactElement, ReactNode } from "react";

import { ContextualHelp } from "@/components/ui/ContextualHelp";
import { classNames } from "@/lib/ui/classNames";

/**
 * Documents the FieldVariant type contract used by app/src/components/ui/Field.tsx.
 * Keep this contract synchronized with service payloads, component props, and tests that consume it.
 */
export type FieldVariant = "actions" | "checkbox" | "default";

interface SharedFieldProps extends PropsWithChildren {
    readonly className?: string;
    readonly dense?: boolean;
    readonly error?: ReactNode;
    readonly fullWidth?: boolean;
    readonly hint?: ReactNode;
    readonly label?: ReactNode;
    readonly variant?: FieldVariant;
}

type FieldProps = SharedFieldProps & ({
    readonly as?: "div";
} & HTMLAttributes<HTMLDivElement> | {
    readonly as?: "label";
} & LabelHTMLAttributes<HTMLLabelElement>);

type LabelableElementProps = {
    readonly "aria-labelledby"?: string;
    readonly id?: string;
};

const getHelpTitle = (value: ReactNode, depth = 0): string => {
    if (depth > 10) {
        return "";
    }

    if (typeof value === "string" || typeof value === "number") {
        return `${value}`;
    }

    if (Array.isArray(value)) {
        return value.map((item) => getHelpTitle(item, depth + 1)).filter((item) => item !== "").join(" ").trim();
    }

    if (isValidElement<{ children?: ReactNode; }>(value)) {
        return getHelpTitle(value.props.children ?? "", depth + 1);
    }

    return "";
};

/**
 * Purpose: Renders the Field UI boundary documented for app/src/components/ui/Field.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const Field = ({
    as,
    children,
    className,
    dense = false,
    error,
    fullWidth = false,
    hint,
    label,
    variant = "default",
    ...restProps
}: FieldProps): JSX.Element => {
    const resolvedElement = hint !== undefined ? "div" : as ?? (variant === "actions" ? "div" : "label");
    const labelId = useId();
    const hintTitle = getHelpTitle(label) || "additional information";
    const childElement = isValidElement(children) ? children as ReactElement<LabelableElementProps> : null;
    const controlId = childElement?.props.id;
    const sharedClassName = classNames(
        "field",
        variant === "actions" && "field--actions",
        variant === "checkbox" && "field--checkbox",
        dense && "field--dense",
        fullWidth && "field--full-width",
        className,
    );
    const labelledChildren = label !== undefined && childElement !== null
        ? cloneElement(childElement, {
            "aria-labelledby": childElement.props["aria-labelledby"] ?? labelId,
        })
        : children;
    const labelContent = label === undefined
        ? null
        : controlId !== undefined
            ? <label className={"field__label"} htmlFor={controlId} id={labelId}>{label}</label>
            : <span className={"field__label"} id={labelId}>{label}</span>;
    const content = (
        <>
            {variant === "checkbox" ? labelledChildren : null}
            {label !== undefined ? (
                <span className={"field__label-row"}>
                    {labelContent}
                    {hint !== undefined ? <ContextualHelp content={hint} title={hintTitle} /> : null}
                </span>
            ) : null}
            {variant === "checkbox" ? null : labelledChildren}
            {error !== undefined ? <p className={"field__error"} role={"alert"}>{error}</p> : null}
        </>
    );

    if (resolvedElement === "div") {
        return <div {...restProps as HTMLAttributes<HTMLDivElement>} className={sharedClassName}>{content}</div>;
    }

    return <label {...restProps as LabelHTMLAttributes<HTMLLabelElement>} className={sharedClassName}>{content}</label>;
};
