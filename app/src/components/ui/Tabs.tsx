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
