/**
 * File: app/src/hooks/useTheme.tsx
 *
 * Purpose:
 * Provides theme preference state, system-theme detection, and document color-scheme synchronization.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, react
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - react
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
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

/**
 * Documents the export const  constant exported by app/src/hooks/useTheme.tsx.
 * Consumers rely on this stable value, so update related docs and tests before changing it.
 */
export const THEME_STORAGE_KEY = "nido-theme";

type ResolvedTheme = "dark" | "light";
/**
 * Documents the ThemePreference type contract used by app/src/hooks/useTheme.tsx.
 * Keep this contract synchronized with service payloads, component props, and tests that consume it.
 */
export type ThemePreference = ResolvedTheme | "system";

interface ThemeContextValue {
    readonly preference: ThemePreference;
    readonly resolvedTheme: ResolvedTheme;
    setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemePreference = (value: string | null): value is ThemePreference => {
    return value === "light" || value === "dark" || value === "system";
};

const getSystemTheme = (): ResolvedTheme => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
    return preference === "system" ? getSystemTheme() : preference;
};

/**
 * Purpose: Executes the getStoredThemePreference operation for app/src/hooks/useTheme.tsx.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getStoredThemePreference = (): ThemePreference => {
    const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedValue) ? storedValue : "system";
};

/**
 * Purpose: Executes the applyThemePreference operation for app/src/hooks/useTheme.tsx.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const applyThemePreference = (preference: ThemePreference): ResolvedTheme => {
    const resolvedTheme = resolveTheme(preference);
    document.documentElement.dataset.theme = resolvedTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    return resolvedTheme;
};

/**
 * Provides light, dark, and system theme state for the entire app shell.
 *
 * @param props The application subtree.
 * @returns The themed provider wrapper.
 */
export const ThemeProvider = ({ children }: PropsWithChildren): JSX.Element => {
    const [preference, setPreference] = useState<ThemePreference>(() => {
        return getStoredThemePreference();
    });
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
        return resolveTheme(preference);
    });

    useEffect(() => {
        setResolvedTheme(applyThemePreference(preference));

        if (preference !== "system") {
            return undefined;
        }

        /*
         * Critical point: system mode must subscribe to OS color-scheme changes and clean up the listener.
         * Leaving this unsynchronized would make the UI ignore system changes; missing cleanup would leak
         * listeners each time the operator toggles between explicit and system preferences.
         */
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (): void => {
            setResolvedTheme(applyThemePreference("system"));
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, [preference]);

    const value = useMemo<ThemeContextValue>(() => ({
        preference,
        resolvedTheme,
        setPreference,
    }), [preference, resolvedTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Reads and updates the current application theme preference.
 *
 * @returns The active theme context.
 */
export const useTheme = (): ThemeContextValue => {
    const context = useContext(ThemeContext);
    if (context === null) {
        throw new Error("useTheme must be used within ThemeProvider.");
    }

    return context;
};
