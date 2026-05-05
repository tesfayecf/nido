/**
 * File: app/src/features/auth/LoginPage.tsx
 *
 * Purpose:
 * Implements the auth feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, @tanstack/react-query, react-router-dom, @/components/ui/Button, @/components/ui/ErrorBanner, @/components/ui/Field, @/components/ui/FormGrid, @/components/ui/Input; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @tanstack/react-query
 * - react-router-dom
 * - @/components/ui/Button
 * - @/components/ui/ErrorBanner
 * - @/components/ui/Field
 * - @/components/ui/FormGrid
 * - @/components/ui/Input
 * - @/components/ui/PasswordInput
 * - @/components/ui/Toolbar
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
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Toolbar } from "@/components/ui/Toolbar";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { isApiError } from "@/lib/api/errors";
import { authKeys } from "@/services/auth/auth.keys";
import { login } from "@/services/auth/auth.service";
import { useSessionStore } from "@/stores/session.store";

/**
 * Renders the standalone login route container.
 *
 * The actual authenticated flow is implemented in the auth feature module. This
 * first pass keeps the route active so the shell and navigation can be verified
 * before all API integrations are complete.
 *
 * @returns The login route container.
 */
export const LoginPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const setSession = useSessionStore((state) => state.setSession);
    const token = useSessionStore((state) => state.token);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const redirectTarget = searchParams.get("redirect") ?? "/dashboard";
    const loginMutation = useMutation({
        mutationFn: login,
        onSuccess(response) {
            setSession({ expiresAt: response.expires_at, token: response.token });
            queryClient.setQueryData(authKeys.me(), response.user);
            void navigate(redirectTarget);
        },
    });

    if (token !== null) {
        return <Navigate replace to={redirectTarget} />;
    }

    return (
        <main className={"login-layout"}>
            <section className={"login-panel"}>
                <Toolbar>
                    <div>
                        <p className={"login-panel__eyebrow"}>{"Access"}</p>
                        <h1 className={"login-panel__title"}>{"Nido"}</h1>
                    </div>
                    <ThemeToggle />
                </Toolbar>
                <p className={"login-panel__description"}>
                    {"Sign in with your local admin account to manage saved searches, notifications, tracked properties, and ingestion workflows from one workspace."}
                </p>

                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        loginMutation.mutate({ email, password });
                    }}
                >
                    <Field label={"Email"}>
                        <Input
                            autoComplete={"username"}
                            onChange={(event) => {
                                setEmail(event.target.value);
                            }}
                            placeholder={"admin@local"}
                            type={"email"}
                            value={email}
                        />
                    </Field>

                    <Field label={"Password"}>
                        <PasswordInput
                            autoComplete={"current-password"}
                            onChange={(event) => {
                                setPassword(event.target.value);
                            }}
                            placeholder={"dev-password"}
                            value={password}
                        />
                    </Field>

                    {loginMutation.isError ? (
                        <ErrorBanner>
                            {isApiError(loginMutation.error) ? loginMutation.error.message : "Login failed."}
                        </ErrorBanner>
                    ) : null}

                    <div className={"login-panel__actions"}>
                        <Button isLoading={loginMutation.isPending} loadingLabel={"Signing in"} type={"submit"}>
                            {"Sign in"}
                        </Button>
                    </div>
                </FormGrid>
            </section>
        </main>
    );
};
