import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

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
    const redirectTarget = searchParams.get("redirect") ?? "/listings";
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
                <p className={"login-panel__eyebrow"}>{"Balanced Iteration"}</p>
                <h1 className={"login-panel__title"}>{"Home Searcher"}</h1>
                <p className={"login-panel__description"}>
                    {"Sign in with the backend bootstrap-admin account to unlock bookmarks, watchlists, notifications, and the backoffice ingestion console."}
                </p>

                <form
                    className={"form-grid"}
                    onSubmit={(event) => {
                        event.preventDefault();
                        loginMutation.mutate({ email, password });
                    }}
                >
                    <label className={"field"}>
                        <span className={"field__label"}>{"Email"}</span>
                        <input
                            autoComplete={"username"}
                            className={"field__control"}
                            onChange={(event) => {
                                setEmail(event.target.value);
                            }}
                            placeholder={"admin@local"}
                            type={"email"}
                            value={email}
                        />
                    </label>

                    <label className={"field"}>
                        <span className={"field__label"}>{"Password"}</span>
                        <input
                            autoComplete={"current-password"}
                            className={"field__control"}
                            onChange={(event) => {
                                setPassword(event.target.value);
                            }}
                            placeholder={"dev-password"}
                            type={"password"}
                            value={password}
                        />
                    </label>

                    {loginMutation.isError ? (
                        <p className={"error-banner"}>
                            {isApiError(loginMutation.error) ? loginMutation.error.message : "Login failed."}
                        </p>
                    ) : null}

                    <div className={"login-panel__actions"}>
                        <button className={"button"} disabled={loginMutation.isPending} type={"submit"}>
                            {loginMutation.isPending ? "Signing in..." : "Sign in"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
};