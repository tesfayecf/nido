import { useEffect, useId, useRef } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/ui/Icon";
import { classNames } from "@/lib/ui/classNames";

interface DialogProps extends PropsWithChildren {
    readonly actions?: ReactNode;
    readonly className?: string;
    readonly description?: ReactNode;
    readonly initialFocusSelector?: string;
    readonly onOpenChange: (open: boolean) => void;
    readonly open: boolean;
    readonly title: ReactNode;
}

const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(", ");

export const Dialog = ({
    actions,
    children,
    className,
    description,
    initialFocusSelector,
    onOpenChange,
    open,
    title,
}: DialogProps): JSX.Element | null => {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    // Lock body scroll and focus the first focusable element only when the dialog opens.
    // Intentionally does not depend on `onOpenChange` so that inline callbacks created by
    // callers on every render do not re-trigger this effect and steal focus mid-typing.
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const primaryTarget = initialFocusSelector !== undefined && contentRef.current !== null
            ? contentRef.current.querySelector<HTMLElement>(initialFocusSelector)
            : null;
        const focusableElements = contentRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
        (primaryTarget ?? focusableElements?.[0])?.focus();

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [initialFocusSelector, open]);

    // Keep the keyboard handler up-to-date with the latest `onOpenChange` reference.
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                onOpenChange(false);
                return;
            }

            if (event.key !== "Tab" || contentRef.current === null) {
                return;
            }

            const nodes = Array.from(contentRef.current.querySelectorAll<HTMLElement>(focusableSelector));
            if (nodes.length === 0) {
                return;
            }

            const firstNode = nodes[0];
            const lastNode = nodes[nodes.length - 1];
            const activeElement = document.activeElement;

            if (firstNode === undefined || lastNode === undefined) {
                return;
            }

            if (!event.shiftKey && activeElement === lastNode) {
                event.preventDefault();
                firstNode.focus();
            }

            if (event.shiftKey && activeElement === firstNode) {
                event.preventDefault();
                lastNode.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onOpenChange, open]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className={"modal-overlay"}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onOpenChange(false);
                }
            }}
            role={"presentation"}
        >
            <div
                aria-describedby={description !== undefined ? descriptionId : undefined}
                aria-labelledby={titleId}
                aria-modal
                className={classNames("dialog", className)}
                ref={contentRef}
                role={"dialog"}
            >
                <div className={"dialog__header"}>
                    <div>
                        <h2 className={"dialog__title"} id={titleId}>{title}</h2>
                        {description !== undefined ? <p className={"dialog__description"} id={descriptionId}>{description}</p> : null}
                    </div>
                    <button aria-label={"Close dialog"} className={"icon-button dialog__close"} onClick={() => { onOpenChange(false); }} type={"button"}>
                        <Icon name={"close"} />
                    </button>
                </div>
                {children !== undefined ? <div className={"dialog__body"}>{children}</div> : null}
                {actions !== undefined ? <div className={"dialog__footer"}>{actions}</div> : null}
            </div>
        </div>,
        document.body,
    );
};
