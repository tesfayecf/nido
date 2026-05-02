import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
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

export const ToastProvider = ({ children }: PropsWithChildren): JSX.Element => {
    const [toasts, setToasts] = useState<ToastDefinition[]>([]);
    const nextToastIdRef = useRef(0);

    const dismissToast = useCallback((id: number): void => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback((message: ReactNode, tone: ToastTone = "info"): void => {
        nextToastIdRef.current += 1;
        const id = nextToastIdRef.current;
        setToasts((current) => [...current, { id, message, tone }]);
        window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4_000);
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

export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (context === null) {
        throw new Error("useToast must be used within ToastProvider.");
    }

    return context;
};
