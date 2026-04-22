import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { classNames } from "@/lib/ui/classNames";

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
