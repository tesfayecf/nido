/**
 * File: app/src/components/ui/ConfirmDialog.tsx
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
 * - Imports: @/components/ui/ActionGroup, @/components/ui/Button, @/components/ui/Dialog
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - @/components/ui/ActionGroup
 * - @/components/ui/Button
 * - @/components/ui/Dialog
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
import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface ConfirmDialogProps {
    readonly confirmLabel: string;
    readonly description: string;
    readonly isPending?: boolean;
    readonly onConfirm: () => void;
    readonly onOpenChange: (open: boolean) => void;
    readonly open: boolean;
    readonly title: string;
}

/**
 * Purpose: Renders the ConfirmDialog UI boundary documented for app/src/components/ui/ConfirmDialog.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const ConfirmDialog = ({
    confirmLabel,
    description,
    isPending = false,
    onConfirm,
    onOpenChange,
    open,
    title,
}: ConfirmDialogProps): JSX.Element => {
    return (
        <Dialog
            actions={(
                <ActionGroup>
                    <Button onClick={() => { onOpenChange(false); }} variant={"secondary"}>{"Cancel"}</Button>
                    <Button data-dialog-primary={"true"} isLoading={isPending} onClick={onConfirm} variant={"destructive"}>{confirmLabel}</Button>
                </ActionGroup>
            )}
            description={description}
            initialFocusSelector={"[data-dialog-primary=\"true\"]"}
            onOpenChange={onOpenChange}
            open={open}
            title={title}
        />
    );
};
