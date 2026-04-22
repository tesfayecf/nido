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
