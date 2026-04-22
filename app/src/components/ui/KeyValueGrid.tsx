import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";

import { classNames } from "@/lib/ui/classNames";

interface KeyValueGridProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
    readonly className?: string;
    readonly compact?: boolean;
}

interface KeyValuePairProps {
    readonly className?: string;
    readonly label: ReactNode;
    readonly value: ReactNode;
}

export const KeyValueGrid = ({ children, className, compact = false, ...restProps }: KeyValueGridProps): JSX.Element => {
    return (
        <div
            {...restProps}
            className={classNames("key-value-grid", compact && "key-value-grid--compact", className)}
        >
            {children}
        </div>
    );
};

export const KeyValuePair = ({ className, label, value }: KeyValuePairProps): JSX.Element => {
    return (
        <div className={className}>
            <span className={"key-value-grid__label"}>{label}</span>
            <strong className={"key-value-grid__value"}>{value}</strong>
        </div>
    );
};
