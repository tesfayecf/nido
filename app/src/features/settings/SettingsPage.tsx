import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useToast } from "@/components/ui/ToastProvider";
import { authKeys } from "@/services/auth/auth.keys";
import { changePassword, getCurrentUser, updateProfile } from "@/services/auth/auth.service";

export const SettingsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const meQuery = useQuery({
        queryFn: getCurrentUser,
        queryKey: authKeys.me(),
    });

    const [displayName, setDisplayName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    useEffect(() => {
        if (meQuery.data !== undefined) {
            setDisplayName(meQuery.data.display_name);
        }
    }, [meQuery.data]);

    const profileMutation = useMutation({
        mutationFn: () => updateProfile({ display_name: displayName.trim() }),
        onError() {
            pushToast("Could not update profile.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: authKeys.me() });
            pushToast("Profile updated.", "success");
        },
    });

    const passwordMutation = useMutation({
        mutationFn: () => changePassword({ current_password: currentPassword, new_password: newPassword }),
        onError() {
            pushToast("Could not change password. Check your current password.", "error");
        },
        onSuccess() {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            pushToast("Password updated.", "success");
        },
    });

    const passwordMismatch = newPassword !== "" && newPassword !== confirmPassword;
    const passwordsReady =
        currentPassword.trim() !== "" &&
        newPassword.trim() !== "" &&
        !passwordMismatch &&
        newPassword.length >= 8;

    return (
        <PageStack>
            <PageCard description={"Update the name shown across the workspace and review your account email."} title={"Account"}>
                {meQuery.data !== undefined ? (
                    <KeyValueGrid compact>
                        <KeyValuePair label={"Email"} value={meQuery.data.email} />
                        <KeyValuePair label={"User id"} value={meQuery.data.id} />
                    </KeyValueGrid>
                ) : null}
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        profileMutation.mutate();
                    }}
                >
                    <Field label={"Display name"}>
                        <Input
                            id={"settings-display-name"}
                            onChange={(event) => { setDisplayName(event.target.value); }}
                            placeholder={"Your name"}
                            type={"text"}
                            value={displayName}
                        />
                    </Field>
                    <ActionGroup>
                        <Button
                            disabled={profileMutation.isPending || displayName.trim() === ""}
                            isLoading={profileMutation.isPending}
                            type={"submit"}
                        >
                            {"Save changes"}
                        </Button>
                    </ActionGroup>
                </FormGrid>
            </PageCard>

            <PageCard description={"Use a strong password of at least eight characters. You will stay signed in on this device."} title={"Password"}>
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        passwordMutation.mutate();
                    }}
                >
                    <Field label={"Current password"}>
                        <Input
                            autoComplete={"current-password"}
                            id={"settings-current-password"}
                            onChange={(event) => { setCurrentPassword(event.target.value); }}
                            type={"password"}
                            value={currentPassword}
                        />
                    </Field>
                    <Field label={"New password"}>
                        <Input
                            autoComplete={"new-password"}
                            id={"settings-new-password"}
                            onChange={(event) => { setNewPassword(event.target.value); }}
                            type={"password"}
                            value={newPassword}
                        />
                    </Field>
                    <Field label={"Confirm new password"}>
                        <Input
                            autoComplete={"new-password"}
                            id={"settings-confirm-password"}
                            onChange={(event) => { setConfirmPassword(event.target.value); }}
                            type={"password"}
                            value={confirmPassword}
                        />
                    </Field>
                    {passwordMismatch ? <ErrorBanner>{"New password and confirmation do not match."}</ErrorBanner> : null}
                    <ActionGroup>
                        <Button
                            disabled={!passwordsReady || passwordMutation.isPending}
                            isLoading={passwordMutation.isPending}
                            type={"submit"}
                        >
                            {"Update password"}
                        </Button>
                    </ActionGroup>
                </FormGrid>
            </PageCard>

            <PageCard description={"Choose how the workspace should look. System matches your operating-system preference."} title={"Appearance"}>
                <ThemeToggle />
            </PageCard>
        </PageStack>
    );
};
