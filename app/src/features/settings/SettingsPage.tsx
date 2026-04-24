import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MultiSelect } from "@/components/ui/MultiSelect";
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
import { propertyKeys } from "@/services/properties/properties.keys";
import { listProperties } from "@/services/properties/properties.service";
import { tagKeys } from "@/services/tags/tags.keys";
import { listTags } from "@/services/tags/tags.service";

interface NotificationPreferencesDraft {
    readonly channels: string[];
    readonly digestMode: boolean;
    readonly mutedPropertyIds: string[];
    readonly mutedTagIds: string[];
    readonly quietHoursEnd: string;
    readonly quietHoursStart: string;
    readonly severityFloor: string;
}

const PREFERENCE_STORAGE_KEY = "home-searcher.notification-preferences";
const DEFAULT_PREFERENCES: NotificationPreferencesDraft = {
    channels: ["in-app", "email"],
    digestMode: true,
    mutedPropertyIds: [],
    mutedTagIds: [],
    quietHoursEnd: "07:00",
    quietHoursStart: "22:00",
    severityFloor: "medium",
};

export const SettingsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const meQuery = useQuery({
        queryFn: getCurrentUser,
        queryKey: authKeys.me(),
    });
    const propertiesQuery = useQuery({
        queryFn: () => listProperties(),
        queryKey: propertyKeys.list(),
    });
    const tagsQuery = useQuery({
        queryFn: listTags,
        queryKey: tagKeys.all(),
    });

    const [displayName, setDisplayName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [preferences, setPreferences] = useState<NotificationPreferencesDraft>(DEFAULT_PREFERENCES);

    useEffect(() => {
        if (meQuery.data !== undefined) {
            setDisplayName(meQuery.data.display_name);
        }
    }, [meQuery.data]);

    useEffect(() => {
        const rawPreferences = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
        if (rawPreferences === null) {
            return;
        }

        try {
            setPreferences({
                ...DEFAULT_PREFERENCES,
                ...JSON.parse(rawPreferences) as Partial<NotificationPreferencesDraft>,
            });
        } catch {
            setPreferences(DEFAULT_PREFERENCES);
        }
    }, []);

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

    const savePreferences = (): void => {
        window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preferences));
        pushToast("Notification preferences saved on this device.", "success");
    };

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

            <PageCard description={"Set quiet hours, route only the severities you care about, and mute noisy property or tag groups without deleting alert rules."} title={"Notification Preferences"}>
                <FormGrid
                    onSubmit={(event) => {
                        event.preventDefault();
                        savePreferences();
                    }}
                >
                    <Field label={"Quiet hours start"}>
                        <Input onChange={(event) => { setPreferences((current) => ({ ...current, quietHoursStart: event.target.value })); }} type={"time"} value={preferences.quietHoursStart} />
                    </Field>
                    <Field label={"Quiet hours end"}>
                        <Input onChange={(event) => { setPreferences((current) => ({ ...current, quietHoursEnd: event.target.value })); }} type={"time"} value={preferences.quietHoursEnd} />
                    </Field>
                    <Field hint={"Batch lower-priority notifications into a digest when enabled."} label={"Digest mode"} variant={"checkbox"}>
                        <input checked={preferences.digestMode} onChange={(event) => { setPreferences((current) => ({ ...current, digestMode: event.target.checked })); }} type={"checkbox"} />
                    </Field>
                    <Field label={"Minimum severity"}>
                        <select className={"field__control"} onChange={(event) => { setPreferences((current) => ({ ...current, severityFloor: event.target.value })); }} value={preferences.severityFloor}>
                            <option value={"low"}>{"Low"}</option>
                            <option value={"medium"}>{"Medium"}</option>
                            <option value={"high"}>{"High"}</option>
                            <option value={"critical"}>{"Critical"}</option>
                        </select>
                    </Field>
                    <Field fullWidth label={"Delivery channels"}>
                        <MultiSelect
                            onChange={(values) => { setPreferences((current) => ({ ...current, channels: values })); }}
                            options={[
                                { label: "In-app", value: "in-app" },
                                { label: "Email", value: "email" },
                                { label: "Webhook", value: "webhook" },
                                { label: "Chat integration", value: "chat" },
                            ]}
                            values={preferences.channels}
                        />
                    </Field>
                    <Field fullWidth label={"Muted properties"}>
                        <MultiSelect
                            onChange={(values) => { setPreferences((current) => ({ ...current, mutedPropertyIds: values })); }}
                            options={(propertiesQuery.data ?? []).map((property) => ({
                                label: property.label !== "" ? property.label : property.url,
                                value: property.id,
                            }))}
                            placeholder={"Mute selected properties"}
                            values={preferences.mutedPropertyIds}
                        />
                    </Field>
                    <Field fullWidth label={"Muted tags"}>
                        <MultiSelect
                            onChange={(values) => { setPreferences((current) => ({ ...current, mutedTagIds: values })); }}
                            options={(tagsQuery.data ?? []).map((tag) => ({ label: tag.name, value: tag.id }))}
                            placeholder={"Mute selected tags"}
                            values={preferences.mutedTagIds}
                        />
                    </Field>
                    <ActionGroup>
                        <Button type={"submit"}>{"Save preferences"}</Button>
                    </ActionGroup>
                </FormGrid>
            </PageCard>
        </PageStack>
    );
};
