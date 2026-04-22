import { create } from "zustand";

/**
 * Describes shell-scoped UI state.
 */
interface ShellState {
    readonly navOpen: boolean;
    setNavOpen: (next: boolean) => void;
    toggleNavOpen: () => void;
}

/**
 * Stores lightweight client-only shell state.
 */
export const useShellStore = create<ShellState>((set) => ({
    navOpen: true,
    setNavOpen: (next: boolean) => {
        set({ navOpen: next });
    },
    toggleNavOpen: () => {
        set((state) => ({ navOpen: !state.navOpen }));
    },
}));
