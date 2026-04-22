import type { PropsWithChildren, ReactNode } from "react";

import { classNames } from "@/lib/ui/classNames";

interface TooltipProps extends PropsWithChildren {
    readonly className?: string;
    readonly content: ReactNode;
}

export const Tooltip = ({ children, className, content }: TooltipProps): JSX.Element => {
    return (
        <span className={classNames("tooltip", className)}>
            <span className={"tooltip__trigger"} tabIndex={0}>{children}</span>
            <span className={"tooltip__content"} role={"tooltip"}>{content}</span>
        </span>
    );
};
