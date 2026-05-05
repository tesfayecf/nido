/**
 * File: app/src/stores/shell.store.ts
 *
 * Purpose:
 * Defines shared client-side state boundaries used across routes and shell-level interactions.
 *
 * Responsibilities:
 * - Define the store shape and mutation actions
 * - Keep cross-route state explicit and serializable where possible
 * - Provide stable selectors or actions for consuming components
 *
 * Inputs:
 * - Imports: zustand
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - zustand
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
 * - /app/docs/state-management.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { create } from "zustand";

const STORAGE_KEY = "nido.nav-collapsed";

const readStoredCollapsed = (): boolean => {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
        return false;
    }
};

const writeStoredCollapsed = (next: boolean): void => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
    } catch {
        /* no-op */
    }
};

/**
 * Describes shell-scoped UI state.
 */
interface ShellState {
    readonly navCollapsed: boolean;
    readonly navOpen: boolean;
    setNavCollapsed: (next: boolean) => void;
    setNavOpen: (next: boolean) => void;
    toggleNavCollapsed: () => void;
    toggleNavOpen: () => void;
}

/**
 * Stores lightweight client-only shell state.
 */
export const useShellStore = create<ShellState>((set) => ({
    navCollapsed: readStoredCollapsed(),
    navOpen: true,
    setNavCollapsed: (next: boolean) => {
        writeStoredCollapsed(next);
        set({ navCollapsed: next });
    },
    setNavOpen: (next: boolean) => {
        set({ navOpen: next });
    },
    toggleNavCollapsed: () => {
        set((state) => {
            const next = !state.navCollapsed;
            writeStoredCollapsed(next);
            return { navCollapsed: next };
        });
    },
    toggleNavOpen: () => {
        set((state) => ({ navOpen: !state.navOpen }));
    },
}));
