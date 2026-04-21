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