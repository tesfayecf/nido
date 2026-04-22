import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
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
    const redirectTarget = searchParams.get("redirect") ?? "/properties";
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
                        <h1 className={"login-panel__title"}>{"Home Searcher"}</h1>
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
                        <Input
                            autoComplete={"current-password"}
                            onChange={(event) => {
                                setPassword(event.target.value);
                            }}
                            placeholder={"dev-password"}
                            type={"password"}
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
                            {loginMutation.isPending ? "Signing in..." : "Sign in"}
                        </Button>
                    </div>
                </FormGrid>
            </section>
        </main>
    );
};
