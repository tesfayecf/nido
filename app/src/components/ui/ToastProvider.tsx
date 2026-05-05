/**
 * File: app/src/components/ui/ToastProvider.tsx
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
 * - Imports: react, @/components/ui/Button
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/Button
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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";

import { Button } from "@/components/ui/Button";

type ToastTone = "error" | "info" | "success";

interface ToastDefinition {
    readonly id: number;
    readonly message: ReactNode;
    readonly tone: ToastTone;
}

interface ToastContextValue {
    dismissToast: (id: number) => void;
    pushToast: (message: ReactNode, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Purpose: Renders the ToastProvider UI boundary documented for app/src/components/ui/ToastProvider.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const ToastProvider = ({ children }: PropsWithChildren): JSX.Element => {
    const [toasts, setToasts] = useState<ToastDefinition[]>([]);
    const nextToastIdRef = useRef(0);
    const timeoutIdsRef = useRef<number[]>([]);

    useEffect(() => {
        return () => {
            timeoutIdsRef.current.forEach((timeoutId) => {
                window.clearTimeout(timeoutId);
            });
            timeoutIdsRef.current = [];
        };
    }, []);

    const dismissToast = useCallback((id: number): void => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback((message: ReactNode, tone: ToastTone = "info"): void => {
        nextToastIdRef.current += 1;
        const id = nextToastIdRef.current;
        setToasts((current) => [...current, { id, message, tone }]);
        const timeoutId = window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
            timeoutIdsRef.current = timeoutIdsRef.current.filter((currentId) => currentId !== timeoutId);
        }, 4_000);
        timeoutIdsRef.current = [...timeoutIdsRef.current, timeoutId];
    }, []);

    const value = useMemo<ToastContextValue>(() => ({
        dismissToast,
        pushToast,
    }), [dismissToast, pushToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div aria-live={"polite"} className={"toast-viewport"}>
                {toasts.map((toast) => {
                    return (
                        <div className={`toast toast--${toast.tone}`} key={toast.id} role={"status"}>
                            <div className={"toast__message"}>{toast.message}</div>
                            <Button onClick={() => { dismissToast(toast.id); }} size={"small"} variant={"ghost"}>{"Dismiss"}</Button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

/**
 * Purpose: Executes the useToast operation for app/src/components/ui/ToastProvider.tsx.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (context === null) {
        throw new Error("useToast must be used within ToastProvider.");
    }

    return context;
};
