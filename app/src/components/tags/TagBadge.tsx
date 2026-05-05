/**
 * File: app/src/components/tags/TagBadge.tsx
 *
 * Purpose:
 * Provides a reusable feature-specific React component used by frontend pages.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @/components/tags/tagColors, @/services/tags/tags.types
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/tags/tagColors
 * - @/services/tags/tags.types
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
