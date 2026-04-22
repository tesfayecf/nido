import type { FormHTMLAttributes, HTMLAttributes, PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

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
