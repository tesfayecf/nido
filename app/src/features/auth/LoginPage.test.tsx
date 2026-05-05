/**
 * File: app/src/features/auth/LoginPage.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of LoginPage and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @tanstack/react-query, @testing-library/react, react-router-dom, vitest, @/features/auth/LoginPage, @/stores/session.store
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @tanstack/react-query
 * - @testing-library/react
 * - react-router-dom
 * - vitest
 * - @/features/auth/LoginPage
 * - @/stores/session.store
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
 * - /app/docs/features/auth.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/features/auth/LoginPage";
import { useSessionStore } from "@/stores/session.store";

vi.mock("@/services/auth/auth.service", () => ({
    login: vi.fn(),
}));

describe("LoginPage", () => {
    afterEach(() => {
        useSessionStore.getState().clearSession();
    });

    it("redirects authenticated users to the dashboard by default", () => {
        useSessionStore.getState().setSession({
            expiresAt: "2999-01-01T00:00:00Z",
            token: "token-123",
        });

        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/login"]}>
                    <Routes>
                        <Route element={<LoginPage />} path={"/login"} />
                        <Route element={<div>{"Dashboard Page"}</div>} path={"/dashboard"} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
    });
});
