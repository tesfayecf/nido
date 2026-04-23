import type { Tag } from "@/services/tags/tags.types";

interface TagBadgeProps {
    readonly tag: Tag;
}

/**
 * Renders a compact tag badge with colored indicator.
 *
 * @param props The tag data.
 * @returns A styled tag badge.
 */
export const TagBadge = ({ tag }: TagBadgeProps): JSX.Element => {
    const backgroundColor = tag.color !== "" ? tag.color : "#6b7280";
    
    return (
        <span
            aria-label={`Tag: ${tag.name}`}
            className={"tag-badge"}
            style={{
                alignItems: "center",
                backgroundColor: `${backgroundColor}20`,
                border: `1px solid ${backgroundColor}40`,
                borderRadius: "0.375rem",
                color: backgroundColor,
                display: "inline-flex",
                fontSize: "0.75rem",
                fontWeight: 500,
                gap: "0.25rem",
                padding: "0.125rem 0.5rem",
                whiteSpace: "nowrap",
            }}
        >
            <span
                aria-hidden
                style={{
                    backgroundColor,
                    borderRadius: "50%",
                    display: "inline-block",
                    height: "0.5rem",
                    width: "0.5rem",
                }}
            />
            {tag.name}
        </span>
    );
};
