import { useState } from "react";
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
    const [activeTabId, setActiveTabId] = useState(defaultTabId ?? items[0]?.id ?? "");

    return (
        <div className={classNames("tabs", className)}>
            <div aria-label={"Sections"} className={"tabs__list"} role={"tablist"}>
                {items.map((item) => {
                    const selected = item.id === activeTabId;
                    return (
                        <button
                            aria-controls={`panel-${item.id}`}
                            aria-selected={selected}
                            className={selected ? "tabs__tab tabs__tab--active" : "tabs__tab"}
                            id={`tab-${item.id}`}
                            key={item.id}
                            onClick={() => {
                                setActiveTabId(item.id);
                            }}
                            role={"tab"}
                            type={"button"}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
            {items.map((item) => {
                const selected = item.id === activeTabId;
                return (
                    <div
                        aria-labelledby={`tab-${item.id}`}
                        className={selected ? "tabs__panel tabs__panel--active" : "tabs__panel"}
                        hidden={!selected}
                        id={`panel-${item.id}`}
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
