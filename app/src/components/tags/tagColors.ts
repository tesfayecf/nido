export const DEFAULT_TAG_COLOR = "#24527a";

export const resolveTagColor = (tagColor: string): string => {
    return tagColor !== "" ? tagColor : "var(--color-text-muted)";
};