/**
 * File: app/src/components/shell/ThemeToggle.tsx
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
 * - Imports: @/hooks/useTheme, @/hooks/useTheme
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - @/hooks/useTheme
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
import { useTheme } from "@/hooks/useTheme";
import type { ThemePreference } from "@/hooks/useTheme";

const options: readonly { label: string; value: ThemePreference; }[] = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "System", value: "system" },
];

/**
 * Renders the global theme switcher.
 *
 * @returns The segmented theme toggle control.
 */
export const ThemeToggle = (): JSX.Element => {
    const { preference, resolvedTheme, setPreference } = useTheme();

    return (
        <div
            aria-label={`Theme selection. ${preference === "system" ? `Following ${resolvedTheme} system preference` : `Using ${preference} theme`}.`}
            className={"theme-toggle"}
            role={"radiogroup"}
        >
            {options.map((option) => {
                const isActive = option.value === preference;
                return (
                    <button
                        aria-checked={isActive}
                        className={isActive ? "theme-toggle__option theme-toggle__option--active" : "theme-toggle__option"}
                        key={option.value}
                        onClick={() => {
                            setPreference(option.value);
                        }}
                        role={"radio"}
                        type={"button"}
                    >
                        <span className={"theme-toggle__label"}>{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
};
