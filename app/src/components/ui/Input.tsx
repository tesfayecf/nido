import type { InputHTMLAttributes, ReactNode } from "react";

import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { classNames } from "@/lib/ui/classNames";

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
