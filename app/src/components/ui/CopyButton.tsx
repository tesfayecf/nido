/**
 * File: app/src/components/ui/CopyButton.tsx
 *
 * Purpose:
 * Provides a reusable design-system UI building block shared across feature workflows.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @/components/ui/Icon, @/lib/ui/classNames
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/Icon
 * - @/lib/ui/classNames
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
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { classNames } from "@/lib/ui/classNames";

interface CopyButtonProps {
    readonly className?: string;
    readonly label?: string;
    readonly value: string;
}

/**
 * Renders a minimal icon-only button that copies the provided value to the
 * clipboard and offers transient visual feedback.
 */
export const CopyButton = ({ className, label = "Copy to clipboard", value }: CopyButtonProps): JSX.Element => {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, []);

    const handleClick = useCallback(async () => {
        const trimmed = value.trim();
        if (trimmed === "") {
            return;
        }

        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText !== undefined) {
                await navigator.clipboard.writeText(trimmed);
            } else if (typeof document !== "undefined") {
                const textarea = document.createElement("textarea");
                textarea.value = trimmed;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "absolute";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }

            setCopied(true);
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }

            timerRef.current = window.setTimeout(() => {
                setCopied(false);
                timerRef.current = null;
            }, 1500);
        } catch {
            // Clipboard access can fail silently when unavailable; no UI change.
        }
    }, [value]);

    const ariaLabel = copied ? `${label} (copied)` : label;

    return (
        <button
            aria-label={ariaLabel}
            aria-live={"polite"}
            className={classNames("copy-button", copied && "copy-button--copied", className)}
            onClick={() => { void handleClick(); }}
            title={copied ? "Copied" : label}
            type={"button"}
        >
            <Icon name={copied ? "check" : "copy"} />
        </button>
    );
};
