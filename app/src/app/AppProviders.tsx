import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "react-router-dom";

import { router } from "@/app/router";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ThemeProvider } from "@/hooks/useTheme";

/**
 * Owns the top-level provider composition for the frontend runtime.
 *
 * The query client is intentionally configured once at module scope so route
 * changes do not recreate caches or mutation state.
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 15_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

/**
 * Renders the full provider tree required by the app shell.
 *
 * @returns The application providers and router.
 */
export const AppProviders = (): JSX.Element => {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <ToastProvider>
                    <RouterProvider router={router} />
                    <ReactQueryDevtools initialIsOpen={false} />
                </ToastProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
};
