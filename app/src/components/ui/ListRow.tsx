import type { HTMLAttributes, PropsWithChildren } from "react";

import { classNames } from "@/lib/ui/classNames";

interface ListRowProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {
    readonly className?: string;
    readonly interactive?: boolean;
}

interface ListRowSectionProps extends PropsWithChildren {
    readonly className?: string;
}

export const ListRow = ({ children, className, interactive = false, ...restProps }: ListRowProps): JSX.Element => {
    return (
        <article
            {...restProps}
            className={classNames("list-row", interactive && "list-row--interactive", className)}
        >
            {children}
        </article>
    );
};

export const ListRowMain = ({ children, className }: ListRowSectionProps): JSX.Element => {
    return <div className={classNames("list-row__main", className)}>{children}</div>;
};

export const ListRowFooter = ({ children, className }: ListRowSectionProps): JSX.Element => {
    return <div className={classNames("list-row__footer", className)}>{children}</div>;
};
