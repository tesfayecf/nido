import { useLocation } from "react-router-dom";

import { CommandPalette } from "@/features/operators/CommandPalette";
import { Icon } from "@/components/ui/Icon";
import { getRouteMeta } from "@/components/shell/navigation";
import { useShellStore } from "@/stores/shell.store";

export const AppHeader = (): JSX.Element => {
    const { pathname } = useLocation();
    const toggleNavCollapsed = useShellStore((state) => state.toggleNavCollapsed);
    const toggleNavOpen = useShellStore((state) => state.toggleNavOpen);
    const meta = getRouteMeta(pathname);

    const handleSidebarToggle = (): void => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 960px)").matches) {
            toggleNavOpen();
            return;
        }

        toggleNavCollapsed();
    };

    return (
        <header className={"app-shell__header"}>
            <div className={"app-shell__header-row"}>
                <button
                    aria-label={"Toggle sidebar"}
                    className={"icon-button app-shell__sidebar-toggle"}
                    onClick={handleSidebarToggle}
                    type={"button"}
                >
                    <Icon name={"sidebar"} />
                </button>
                <div className={"app-shell__header-copy"}>
                    <span className={"app-shell__breadcrumb"}>{meta.section}</span>
                    <span aria-hidden className={"app-shell__breadcrumb-sep"}>{"/"}</span>
                    <h1 className={"app-shell__page-title"}>{meta.title}</h1>
                </div>
                <div className={"app-shell__header-actions"}>
                    <CommandPalette />
                </div>
            </div>
        </header>
    );
};
