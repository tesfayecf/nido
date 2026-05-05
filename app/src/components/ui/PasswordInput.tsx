/**
 * File: app/src/components/ui/PasswordInput.tsx
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
 * - Imports: react, @/components/ui/Button, @/components/ui/Input
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/Button
 * - @/components/ui/Input
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
import { useState } from "react";
import type { InputHTMLAttributes } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
    readonly className?: string;
};

/**
 * Purpose: Renders the PasswordInput UI boundary documented for app/src/components/ui/PasswordInput.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const PasswordInput = ({ className, ...restProps }: PasswordInputProps): JSX.Element => {
    const [visible, setVisible] = useState(false);

    const toggle = (): void => setVisible((v) => !v);
    const label = visible ? "Hide password" : "Show password";

    return (
        <Input
            {...restProps}
            className={className}
            type={visible ? "text" : "password"}
            suffix={(
                <Button
                    aria-pressed={visible}
                    aria-label={label}
                    onClick={toggle}
                    size={"small"}
                    variant={"ghost"}
                >
                    {visible ? "Hide" : "Show"}
                </Button>
            )}
        />
    );
};
