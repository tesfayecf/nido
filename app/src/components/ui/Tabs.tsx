/**
 * File: app/src/components/ui/Tabs.tsx
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
 * - Imports: react, react, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - react
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
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { classNames } from "@/lib/ui/classNames";

interface TabItem {
    readonly id: string;
    readonly label: ReactNode;
    readonly panel: ReactNode;
}

interface TabsProps {
    readonly className?: string;
    readonly defaultTabId?: string;
    readonly items: TabItem[];
}

/**
 * Purpose: Renders the Tabs UI boundary documented for app/src/components/ui/Tabs.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const Tabs = ({ className, defaultTabId, items }: TabsProps): JSX.Element => {
    const instanceId = useId();
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const initialTabId = defaultTabId !== undefined && items.some((item) => item.id === defaultTabId)
        ? defaultTabId
        : items[0]?.id ?? "";
    const [activeTabId, setActiveTabId] = useState(initialTabId);
    const tabIdsByItemId = useMemo(() => {
        return new Map(items.map((item) => [
            item.id,
            {
                panelId: `${instanceId}-panel-${item.id}`,
                tabId: `${instanceId}-tab-${item.id}`,
            },
        ]));
    }, [instanceId, items]);

    useEffect(() => {
        if (items.some((item) => item.id === activeTabId)) {
            return;
        }

        setActiveTabId(initialTabId);
    }, [activeTabId, initialTabId, items]);

    const focusTab = (nextTabId: string): void => {
        setActiveTabId(nextTabId);
        tabRefs.current[nextTabId]?.focus();
    };

    return (
        <div className={classNames("tabs", className)}>
            <div aria-label={"Sections"} className={"tabs__list"} role={"tablist"}>
                {items.map((item, index) => {
                    const selected = item.id === activeTabId;
                    const ids = tabIdsByItemId.get(item.id);
                    return (
                        <button
                            aria-controls={ids?.panelId}
                            aria-selected={selected}
                            className={selected ? "tabs__tab tabs__tab--active" : "tabs__tab"}
                            id={ids?.tabId}
                            key={item.id}
                            onClick={() => {
                                setActiveTabId(item.id);
                            }}
                            onKeyDown={(event) => {
                                if (items.length <= 1) {
                                    return;
                                }

                                if (event.key === "ArrowRight") {
                                    event.preventDefault();
                                    focusTab(items[(index + 1) % items.length]?.id ?? item.id);
                                }

                                if (event.key === "ArrowLeft") {
                                    event.preventDefault();
                                    focusTab(items[(index - 1 + items.length) % items.length]?.id ?? item.id);
                                }

                                if (event.key === "Home") {
                                    event.preventDefault();
                                    focusTab(items[0]?.id ?? item.id);
                                }

                                if (event.key === "End") {
                                    event.preventDefault();
                                    focusTab(items[items.length - 1]?.id ?? item.id);
                                }
                            }}
                            ref={(element) => {
                                tabRefs.current[item.id] = element;
                            }}
                            role={"tab"}
                            tabIndex={selected ? 0 : -1}
                            type={"button"}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
            {items.map((item) => {
                const selected = item.id === activeTabId;
                const ids = tabIdsByItemId.get(item.id);
                return (
                    <div
                        aria-labelledby={ids?.tabId}
                        className={selected ? "tabs__panel tabs__panel--active" : "tabs__panel"}
                        hidden={!selected}
                        id={ids?.panelId}
                        key={item.id}
                        role={"tabpanel"}
                    >
                        {item.panel}
                    </div>
                );
            })}
        </div>
    );
};
