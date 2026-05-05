/**
 * File: app/src/app/AppProviders.tsx
 *
 * Purpose:
 * Composes application-wide providers that make routing, server state, and UI state available to descendants.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @tanstack/react-query-devtools, react-router-dom, @/app/router, @/components/ui/ToastProvider, @/hooks/useTheme
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - @tanstack/react-query
 * - @tanstack/react-query-devtools
 * - react-router-dom
 * - @/app/router
 * - @/components/ui/ToastProvider
 * - @/hooks/useTheme
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
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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
