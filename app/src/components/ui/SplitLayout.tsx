import type { PropsWithChildren, ReactNode } from "react";

import { classNames } from "@/lib/ui/classNames";

interface SplitLayoutProps extends PropsWithChildren {
    readonly aside?: ReactNode;
    readonly className?: string;
}

export const SplitLayout = ({ aside, children, className }: SplitLayoutProps): JSX.Element => {
    return (
        <div className={classNames("split-layout", className)}>
            <div className={"page-stack"}>{children}</div>
            {aside}
        </div>
    );
};
