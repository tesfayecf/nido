import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FocusEvent } from "react";

import { Icon } from "@/components/ui/Icon";
import { classNames } from "@/lib/ui/classNames";

const CONTEXTUAL_HELP_OPEN_EVENT = "nido:contextual-help-open";

interface ContextualHelpProps {
    readonly className?: string;
    readonly content: string;
    readonly title: string;
}

export const ContextualHelp = ({ className, content, title }: ContextualHelpProps): JSX.Element => {
    const instanceId = useId();
    const popoverId = useId();
    const rootRef = useRef<HTMLSpanElement | null>(null);
    const [open, setOpen] = useState(false);

    const closePopover = useCallback((): void => {
        setOpen(false);
    }, []);

    const openPopover = useCallback((): void => {
        window.dispatchEvent(new CustomEvent(CONTEXTUAL_HELP_OPEN_EVENT, { detail: instanceId }));
        setOpen(true);
    }, [instanceId]);

    useEffect(() => {
        const handleOpen = (event: Event): void => {
            const customEvent = event as CustomEvent<string>;
            if (customEvent.detail !== instanceId) {
                setOpen(false);
            }
        };

        window.addEventListener(CONTEXTUAL_HELP_OPEN_EVENT, handleOpen);
        return () => {
            window.removeEventListener(CONTEXTUAL_HELP_OPEN_EVENT, handleOpen);
        };
    }, [instanceId]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handlePointerDown = (event: PointerEvent): void => {
            const target = event.target;
            if (target instanceof Node && rootRef.current?.contains(target)) {
                return;
            }

            setOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") {
                return;
            }

            setOpen(false);
            if (document.activeElement instanceof HTMLElement && rootRef.current?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const handleBlur = (event: FocusEvent<HTMLSpanElement>): void => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && rootRef.current?.contains(nextTarget)) {
            return;
        }

        closePopover();
    };

    return (
        <span
            className={classNames("contextual-help", className)}
            onBlur={handleBlur}
            onFocus={openPopover}
            onMouseEnter={openPopover}
            onMouseLeave={closePopover}
            ref={rootRef}
        >
            <button
                aria-controls={popoverId}
                aria-expanded={open}
                aria-haspopup={"dialog"}
                aria-label={`Show help for ${title}`}
                className={"contextual-help__trigger"}
                onClick={() => {
                    if (open) {
                        closePopover();
                        return;
                    }

                    openPopover();
                }}
                type={"button"}
            >
                <Icon className={"contextual-help__icon"} name={"info"} />
                <span className={"sr-only"}>{content}</span>
            </button>
            {open ? (
                <span className={"contextual-help__popover"} id={popoverId} role={"tooltip"}>
                    {content}
                </span>
            ) : null}
        </span>
    );
};
