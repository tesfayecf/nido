/**
 * File: app/src/app/RequireAuth.test.tsx
 *
 * Purpose:
 * Validates the documented behavior of RequireAuth and protects the frontend contract from regressions.
 *
 * Responsibilities:
 * - Arrange representative user or service scenarios
 * - Assert rendered output, state transitions, or utility return values
 * - Document regression-sensitive behavior through executable expectations
 *
 * Inputs:
 * - Imports: @testing-library/react, react-router-dom, vitest, @/app/RequireAuth, @/stores/session.store
 *
 * Outputs:
 * - Vitest assertions that pass or fail during automated validation
 *
 * Dependencies:
 * - @testing-library/react
 * - react-router-dom
 * - vitest
 * - @/app/RequireAuth
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
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { RequireAuth } from "@/app/RequireAuth";
import { useSessionStore } from "@/stores/session.store";

describe("RequireAuth", () => {
    beforeEach(() => {
        useSessionStore.getState().clearSession();
    });

    it("redirects expired sessions back to login and clears the stored token", () => {
        useSessionStore.getState().setSession({
            expiresAt: "2020-01-01T00:00:00Z",
            token: "token-123",
        });

        render(
            <MemoryRouter initialEntries={["/private"]}>
                <Routes>
                    <Route element={<RequireAuth />} path={"/private"}>
                        <Route element={<div>{"Protected"}</div>} index />
                    </Route>
                    <Route element={<div>{"Login Page"}</div>} path={"/login"} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(useSessionStore.getState().token).toBeNull();
    });

    it("renders protected routes for active sessions", () => {
        useSessionStore.getState().setSession({
            expiresAt: "2999-01-01T00:00:00Z",
            token: "token-123",
        });

        render(
            <MemoryRouter initialEntries={["/private"]}>
                <Routes>
                    <Route element={<RequireAuth />} path={"/private"}>
                        <Route element={<div>{"Protected"}</div>} index />
                    </Route>
                    <Route element={<div>{"Login Page"}</div>} path={"/login"} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText("Protected")).toBeInTheDocument();
    });
});