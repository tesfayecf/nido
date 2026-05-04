import { Children, Fragment, cloneElement, isValidElement, useId } from "react";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";

import { classNames } from "@/lib/ui/classNames";

interface TooltipProps extends PropsWithChildren {
    readonly className?: string;
    readonly content: ReactNode;
}

interface TooltipTriggerProps {
    readonly "aria-describedby"?: string;
}

export const Tooltip = ({ children, className, content }: TooltipProps): JSX.Element => {
    const tooltipId = useId();
    const childItems = Children.toArray(children);
    const singleChild = childItems.length === 1 ? childItems[0] : null;
    const canCloneChild = isValidElement<TooltipTriggerProps>(singleChild) && singleChild.type !== Fragment;
    const triggerContent = canCloneChild
        ? cloneElement(singleChild as ReactElement<TooltipTriggerProps>, {
            "aria-describedby": appendAriaDescription(singleChild.props["aria-describedby"], tooltipId),
        })
        : children;

    return (
        <span className={classNames("tooltip", className)}>
            {canCloneChild ? (
                <span className={"tooltip__trigger"}>{triggerContent}</span>
            ) : (
                <span aria-describedby={tooltipId} className={"tooltip__trigger"} tabIndex={0}>{triggerContent}</span>
            )}
            <span className={"tooltip__content"} id={tooltipId} role={"tooltip"}>{content}</span>
        </span>
    );
};

const appendAriaDescription = (currentValue: string | undefined, nextValue: string): string => {
    if (currentValue === undefined || currentValue.trim() === "") {
        return nextValue;
    }

    const tokens = currentValue.split(/\s+/);
    return tokens.includes(nextValue) ? currentValue : `${currentValue} ${nextValue}`;
};
