/**
 * File: app/src/components/shell/AppHeader.tsx
 *
 * Purpose:
 * Provides shell navigation, header, theme, or workspace chrome used around authenticated pages.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react-router-dom, @/features/operators/CommandPalette, @/components/ui/Icon, @/components/shell/navigation, @/stores/shell.store
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react-router-dom
 * - @/features/operators/CommandPalette
 * - @/components/ui/Icon
 * - @/components/shell/navigation
 * - @/stores/shell.store
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
import { useLocation } from "react-router-dom";

import { CommandPalette } from "@/features/operators/CommandPalette";
import { Icon } from "@/components/ui/Icon";
import { getRouteMeta } from "@/components/shell/navigation";
import { useShellStore } from "@/stores/shell.store";

/**
 * Purpose: Renders the AppHeader UI boundary documented for app/src/components/shell/AppHeader.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
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
