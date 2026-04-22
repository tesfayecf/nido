import type { PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

interface ActionGroupProps extends PropsWithChildren {
    readonly className?: string;
}

export const ActionGroup = ({ children, className }: ActionGroupProps): JSX.Element => {
    return <div className={classNames("action-group", className)}>{children}</div>;
};
