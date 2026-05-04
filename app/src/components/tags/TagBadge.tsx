import type { CSSProperties } from "react";

import { resolveTagColor } from "@/components/tags/tagColors";
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
    const tagColor = resolveTagColor(tag.color);
    
    return (
        <span
            aria-label={`Tag: ${tag.name}`}
            className={"tag-badge"}
            style={{ "--tag-color": tagColor } as CSSProperties}
        >
            <span aria-hidden className={"tag-badge__swatch"} />
            {tag.name}
        </span>
    );
};
