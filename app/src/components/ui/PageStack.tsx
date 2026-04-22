import type { PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

interface PageStackProps extends PropsWithChildren {
    readonly className?: string;
}

export const PageStack = ({ children, className }: PageStackProps): JSX.Element => {
    return <div className={classNames("page-stack", className)}>{children}</div>;
};
