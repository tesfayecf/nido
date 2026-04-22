import type { TextareaHTMLAttributes } from "react";

import { classNames } from "@/lib/ui/classNames";

import type { ControlSize } from "@/components/ui/Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    readonly className?: string;
    readonly invalid?: boolean;
    readonly size?: ControlSize;
}

const sizeClassNames: Record<ControlSize, string> = {
    large: "field__control--large",
    medium: "field__control--medium",
    small: "field__control--small",
};

export const Textarea = ({
    className,
    invalid = false,
    size = "medium",
    ...restProps
}: TextareaProps): JSX.Element => {
    return (
        <textarea
            {...restProps}
            className={classNames(
                "field__control",
                "field__control--textarea",
                sizeClassNames[size],
                invalid && "field__control--error",
                className,
            )}
        />
    );
};
