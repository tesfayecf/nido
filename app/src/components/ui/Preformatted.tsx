import type { HTMLAttributes } from "react";

import { classNames } from "@/lib/ui/classNames";

interface PreformattedProps extends HTMLAttributes<HTMLPreElement> {
    readonly compact?: boolean;
}

export const Preformatted = ({ children, className, compact = false, ...restProps }: PreformattedProps): JSX.Element => {
    return (
        <pre
            {...restProps}
            className={classNames("preformatted", compact && "preformatted--compact", className)}
        >
            {children}
        </pre>
    );
};
