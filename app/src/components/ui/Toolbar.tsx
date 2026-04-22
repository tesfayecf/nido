/* eslint-disable react/jsx-props-no-spreading */
import type { HTMLAttributes, PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

interface ToolbarProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
    readonly className?: string;
    readonly stacked?: boolean;
}

export const Toolbar = ({ children, className, stacked = false, ...restProps }: ToolbarProps): JSX.Element => {
    return <div {...restProps} className={classNames("toolbar", stacked && "toolbar--stacked", className)}>{children}</div>;
};
