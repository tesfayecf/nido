/**
 * File: app/src/components/ui/RowActions.tsx
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
 * - Imports: react, react, @/components/ui/Icon, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
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
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { classNames } from "@/lib/ui/classNames";

/**
 * Purpose: Renders the OverflowMenuItem UI boundary documented for app/src/components/ui/RowActions.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export interface OverflowMenuItem {
    readonly destructive?: boolean;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onSelect: () => void;
}

interface OverflowMenuProps {
    readonly buttonLabel?: string;
    readonly className?: string;
    readonly items: readonly OverflowMenuItem[];
}

/**
 * Renders a 3-dot overflow menu used for compact row-level secondary actions.
 *
 * The menu is keyboard accessible, dismisses on outside click or Escape, and
 * intentionally avoids any portal so it inherits the row's stacking context.
 */
export const OverflowMenu = ({ buttonLabel = "More actions", className, items }: OverflowMenuProps): JSX.Element | null => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const buttonId = useId();
    const menuId = useId();

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handlePointerDown = (event: PointerEvent): void => {
            if (containerRef.current?.contains(event.target as Node) === true) {
                return;
            }

            setOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const usableItems = items.filter((item) => item.disabled !== true);
    if (usableItems.length === 0) {
        return null;
    }

    return (
        <div
            className={classNames("overflow-menu", className)}
            onClick={(event) => { event.stopPropagation(); }}
            ref={containerRef}
        >
            <button
                aria-controls={menuId}
                aria-expanded={open}
                aria-haspopup={"menu"}
                aria-label={buttonLabel}
                className={"icon-button overflow-menu__trigger"}
                id={buttonId}
                onClick={() => { setOpen((current) => !current); }}
                type={"button"}
            >
                <Icon name={"more-horizontal"} />
            </button>
            {open ? (
                <div
                    aria-labelledby={buttonId}
                    className={"overflow-menu__panel"}
                    id={menuId}
                    role={"menu"}
                >
                    {items.map((item) => {
                        return (
                            <button
                                className={classNames(
                                    "overflow-menu__item",
                                    item.destructive === true && "overflow-menu__item--destructive",
                                )}
                                disabled={item.disabled}
                                key={item.label}
                                onClick={() => {
                                    setOpen(false);
                                    item.onSelect();
                                }}
                                role={"menuitem"}
                                type={"button"}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
};

interface RowActionsProps {
    readonly children?: ReactNode;
    readonly menuItems?: readonly OverflowMenuItem[];
}

/**
 * Convenience wrapper that places primary visible row actions next to an
 * overflow menu. Stops propagation so row clicks aren't triggered.
 */
export const RowActions = ({ children, menuItems }: RowActionsProps): JSX.Element => {
    return (
        <div className={"row-actions"} onClick={(event) => { event.stopPropagation(); }}>
            {children}
            {menuItems !== undefined && menuItems.length > 0 ? <OverflowMenu items={menuItems} /> : null}
        </div>
    );
};
