import type { HTMLAttributes, PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

interface ItemListProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
    readonly className?: string;
}

export const ItemList = ({ children, className, ...restProps }: ItemListProps): JSX.Element => {
    return <div {...restProps} className={classNames("item-list", className)}>{children}</div>;
};
