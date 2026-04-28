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
