/**
 * File: app/src/components/ui/ContextualHelp.tsx
 *
 * Purpose:
 * Provides a reusable design-system UI building block shared across feature workflows.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @/components/ui/Icon, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/Icon
 * - @/lib/ui/classNames
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { classNames } from "@/lib/ui/classNames";

const CONTEXTUAL_HELP_OPEN_EVENT = "nido:contextual-help-open";

interface ContextualHelpProps {
    readonly className?: string;
    readonly content: ReactNode;
    readonly title: string;
}

/**
 * Purpose: Renders the ContextualHelp UI boundary documented for app/src/components/ui/ContextualHelp.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
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
            onMouseEnter={openPopover}
            onMouseLeave={closePopover}
            ref={rootRef}
        >
            <button
                aria-controls={popoverId}
                aria-describedby={open ? popoverId : undefined}
                aria-expanded={open}
                aria-haspopup={"true"}
                aria-label={`Show help for ${title}`}
                className={"contextual-help__trigger"}
                onClick={() => {
                    if (open) {
                        closePopover();
                        return;
                    }

                    openPopover();
                }}
                onFocus={openPopover}
                type={"button"}
            >
                <Icon className={"contextual-help__icon"} name={"info"} />
            </button>
            {open ? (
                <div className={"contextual-help__popover"} id={popoverId} role={"tooltip"}>
                    {content}
                </div>
            ) : null}
        </span>
    );
};
