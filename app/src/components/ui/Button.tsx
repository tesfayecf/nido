import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { classNames } from "@/lib/ui/classNames";

export type ButtonSize = "large" | "medium" | "small";
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
    primary: "button",
    secondary: "button--secondary",
};

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
