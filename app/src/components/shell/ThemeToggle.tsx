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
