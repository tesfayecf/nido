import { create } from "zustand";

const STORAGE_KEY = "home-searcher.nav-collapsed";

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
