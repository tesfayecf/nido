/* eslint-disable react/jsx-props-no-spreading */
import type { HTMLAttributes, LabelHTMLAttributes, PropsWithChildren, ReactNode } from "react";

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
    const resolvedElement = as ?? (variant === "actions" ? "div" : "label");
    const sharedClassName = classNames(
        "field",
        variant === "actions" && "field--actions",
        variant === "checkbox" && "field--checkbox",
        dense && "field--dense",
        fullWidth && "field--full-width",
        className,
    );
    const content = (
        <>
            {variant === "checkbox" ? (
                <>
                    {children}
                    {label !== undefined ? <span className={"field__label"}>{label}</span> : null}
                </>
            ) : (
                <>
                    {label !== undefined ? <span className={"field__label"}>{label}</span> : null}
                    {children}
                </>
            )}
            {hint !== undefined ? <p className={"field__hint"}>{hint}</p> : null}
            {error !== undefined ? <p className={"field__error"} role={"alert"}>{error}</p> : null}
        </>
    );

    if (resolvedElement === "div") {
        return <div {...restProps as HTMLAttributes<HTMLDivElement>} className={sharedClassName}>{content}</div>;
    }

    return <label {...restProps as LabelHTMLAttributes<HTMLLabelElement>} className={sharedClassName}>{content}</label>;
};
