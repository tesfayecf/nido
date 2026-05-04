/* eslint-disable react/jsx-props-no-spreading */
import { cloneElement, isValidElement, useId } from "react";
import type { HTMLAttributes, LabelHTMLAttributes, PropsWithChildren, ReactElement, ReactNode } from "react";

import { ContextualHelp } from "@/components/ui/ContextualHelp";
import { classNames } from "@/lib/ui/classNames";

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
