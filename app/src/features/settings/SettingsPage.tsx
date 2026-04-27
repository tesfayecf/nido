import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { authKeys } from "@/services/auth/auth.keys";
import { changePassword, getCurrentUser, updateProfile } from "@/services/auth/auth.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { tagKeys } from "@/services/tags/tags.keys";
import { listTags } from "@/services/tags/tags.service";

import {
    formatMultilineValue,
    parseMultilineValue,
    readWorkspaceSettings,
    saveWorkspaceSettings,
    type WorkspaceSettings,
} from "@/features/settings/workspaceSettings";

interface NotificationPreferencesDraft {
    readonly channels: string[];
    readonly digestMode: boolean;
    readonly mutedTagIds: string[];
    readonly quietHoursEnd: string;
    readonly quietHoursStart: string;
    readonly severityFloor: string;
}

const PREFERENCE_STORAGE_KEY = "nido.notification-preferences";
const DEFAULT_PREFERENCES: NotificationPreferencesDraft = {
    channels: ["in-app", "email"],
    digestMode: true,
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
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
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
    const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => readWorkspaceSettings());
    const [priceFieldsText, setPriceFieldsText] = useState("");
    const [areaFieldsText, setAreaFieldsText] = useState("");
    const [comparableFieldsText, setComparableFieldsText] = useState("");
    const [locationFieldsText, setLocationFieldsText] = useState("");
    const [typeFieldsText, setTypeFieldsText] = useState("");

    useEffect(() => {
        if (meQuery.data !== undefined) {
            setDisplayName(meQuery.data.display_name);
        }
    }, [meQuery.data]);

    useEffect(() => {
        const storedSettings = readWorkspaceSettings();
        setWorkspaceSettings(storedSettings);
        setPriceFieldsText(formatMultilineValue(storedSettings.field_mappings.price_fields));
        setAreaFieldsText(formatMultilineValue(storedSettings.field_mappings.area_fields));
        setComparableFieldsText(formatMultilineValue(storedSettings.field_mappings.comparable_fields));
        setLocationFieldsText(formatMultilineValue(storedSettings.field_mappings.location_fields));
        setTypeFieldsText(formatMultilineValue(storedSettings.field_mappings.type_fields));

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

    const persistWorkspaceSettings = (): void => {
        const nextSettings: WorkspaceSettings = {
            ...workspaceSettings,
            field_mappings: {
                area_fields: parseMultilineValue(areaFieldsText),
                comparable_fields: parseMultilineValue(comparableFieldsText),
                location_fields: parseMultilineValue(locationFieldsText),
                price_fields: parseMultilineValue(priceFieldsText),
                type_fields: parseMultilineValue(typeFieldsText),
            },
        };
        setWorkspaceSettings(nextSettings);
        saveWorkspaceSettings(nextSettings);
        pushToast("Workspace settings applied immediately on this device.", "success");
    };

    return (
        <PageStack>
            <PageCard
                description={"Keep price evaluation defaults, property intake behavior, recovery, and data movement controls clearly separated."}
                title={"Settings"}
            >
                <Tabs
                    defaultTabId={"user"}
                    items={[
                        {
                            id: "user",
                            label: "User settings",
                            panel: (
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
                                                <Button disabled={profileMutation.isPending || displayName.trim() === ""} isLoading={profileMutation.isPending} type={"submit"}>
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
                                                <Input autoComplete={"current-password"} id={"settings-current-password"} onChange={(event) => { setCurrentPassword(event.target.value); }} type={"password"} value={currentPassword} />
                                            </Field>
                                            <Field label={"New password"}>
                                                <Input autoComplete={"new-password"} id={"settings-new-password"} onChange={(event) => { setNewPassword(event.target.value); }} type={"password"} value={newPassword} />
                                            </Field>
                                            <Field label={"Confirm new password"}>
                                                <Input autoComplete={"new-password"} id={"settings-confirm-password"} onChange={(event) => { setConfirmPassword(event.target.value); }} type={"password"} value={confirmPassword} />
                                            </Field>
                                            {passwordMismatch ? <ErrorBanner>{"New password and confirmation do not match."}</ErrorBanner> : null}
                                            <ActionGroup>
                                                <Button disabled={!passwordsReady || passwordMutation.isPending} isLoading={passwordMutation.isPending} type={"submit"}>
                                                    {"Update password"}
                                                </Button>
                                            </ActionGroup>
                                        </FormGrid>
                                    </PageCard>

                                    <PageCard description={"Control how pricing signals and personal workspace defaults appear."} title={"Preferences"}>
                                        <FormGrid
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                persistWorkspaceSettings();
                                                savePreferences();
                                            }}
                                        >
                                            <Field label={"Display density"}>
                                                <Select onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, preferences: { ...current.preferences, density: event.target.value as WorkspaceSettings["preferences"]["density"] } })); }} value={workspaceSettings.preferences.density}>
                                                    <option value={"comfortable"}>{"Comfortable"}</option>
                                                    <option value={"compact"}>{"Compact"}</option>
                                                </Select>
                                            </Field>
                                            <Field label={"Display locale"}>
                                                <Input onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, preferences: { ...current.preferences, display_locale: event.target.value } })); }} value={workspaceSettings.preferences.display_locale} />
                                            </Field>
                                            <Field label={"Display currency"}>
                                                <Input onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, preferences: { ...current.preferences, display_currency: event.target.value.toUpperCase() } })); }} value={workspaceSettings.preferences.display_currency} />
                                            </Field>
                                            <Field label={"Cheap threshold (%)"}>
                                                <Input min={0} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, thresholds: { ...current.thresholds, cheap_below_percent: Number(event.target.value) || 0 } })); }} type={"number"} value={workspaceSettings.thresholds.cheap_below_percent} />
                                            </Field>
                                            <Field label={"Expensive threshold (%)"}>
                                                <Input min={0} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, thresholds: { ...current.thresholds, expensive_above_percent: Number(event.target.value) || 0 } })); }} type={"number"} value={workspaceSettings.thresholds.expensive_above_percent} />
                                            </Field>
                                            <Field fullWidth label={"Default field mappings"}>
                                                <Textarea onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, preferences: { ...current.preferences, default_field_mappings_text: event.target.value } })); }} rows={4} value={workspaceSettings.preferences.default_field_mappings_text} />
                                            </Field>
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
                                            <Field fullWidth label={"Muted tags"}>
                                                <MultiSelect
                                                    onChange={(values) => { setPreferences((current) => ({ ...current, mutedTagIds: values })); }}
                                                    options={(tagsQuery.data ?? []).map((tag) => ({ label: tag.name, value: tag.id }))}
                                                    placeholder={"Mute selected tags"}
                                                    values={preferences.mutedTagIds}
                                                />
                                            </Field>
                                            <ActionGroup>
                                                <Button type={"submit"}>{"Save user settings"}</Button>
                                            </ActionGroup>
                                        </FormGrid>
                                    </PageCard>

                                    <PageCard description={"Theme changes apply immediately to the current workspace."} title={"Appearance"}>
                                        <ThemeToggle />
                                    </PageCard>
                                </PageStack>
                            ),
                        },
                        {
                            id: "operations",
                            label: "Operations settings",
                            panel: (
                                <PageStack>
                                    <PageCard description={"Keep the fast property flow lightweight while still defining safe defaults for advanced behavior."} title={"Property intake defaults"}>
                                        <FormGrid
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                persistWorkspaceSettings();
                                            }}
                                        >
                                            <Field label={"Default source"}>
                                                <Select onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, default_source_id: event.target.value } })); }} value={workspaceSettings.operations.default_source_id}>
                                                    <option value={""}>{"No default source"}</option>
                                                    {(sourcesQuery.data ?? []).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                                                </Select>
                                            </Field>
                                            <Field label={"Default interval value"}>
                                                <Input onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, default_schedule_interval_value: event.target.value } })); }} value={workspaceSettings.operations.default_schedule_interval_value} />
                                            </Field>
                                            <Field label={"Default interval unit"}>
                                                <Select onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, default_schedule_interval_unit: event.target.value as WorkspaceSettings["operations"]["default_schedule_interval_unit"] } })); }} value={workspaceSettings.operations.default_schedule_interval_unit}>
                                                    <option value={"minutes"}>{"Minutes"}</option>
                                                    <option value={"hours"}>{"Hours"}</option>
                                                    <option value={"seconds"}>{"Seconds"}</option>
                                                </Select>
                                            </Field>
                                            <Field label={"Default retry attempts"}>
                                                <Input min={1} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, default_retry_max_attempts: Number(event.target.value) || 1 } })); }} type={"number"} value={workspaceSettings.operations.default_retry_max_attempts} />
                                            </Field>
                                            <Field label={"Default retry backoff (ms)"}>
                                                <Input min={0} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, default_retry_backoff_millis: Number(event.target.value) || 0 } })); }} type={"number"} value={workspaceSettings.operations.default_retry_backoff_millis} />
                                            </Field>
                                            <Field hint={"Allow URL-only property creation and fill price fields later."} label={"Allow empty price on create"} variant={"checkbox"}>
                                                <input checked={workspaceSettings.operations.allow_empty_price_on_create} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, allow_empty_price_on_create: event.target.checked } })); }} type={"checkbox"} />
                                            </Field>
                                            <Field hint={"Run extraction preview automatically when the user opens the additional-fields section."} label={"Auto preview on create"} variant={"checkbox"}>
                                                <input checked={workspaceSettings.operations.auto_preview_on_create} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, auto_preview_on_create: event.target.checked } })); }} type={"checkbox"} />
                                            </Field>
                                            <Field fullWidth label={"Price field candidates"}>
                                                <Textarea onChange={(event) => { setPriceFieldsText(event.target.value); }} rows={4} value={priceFieldsText} />
                                            </Field>
                                            <Field fullWidth label={"Area field candidates"}>
                                                <Textarea onChange={(event) => { setAreaFieldsText(event.target.value); }} rows={4} value={areaFieldsText} />
                                            </Field>
                                            <Field fullWidth label={"Comparable fields"}>
                                                <Textarea onChange={(event) => { setComparableFieldsText(event.target.value); }} rows={4} value={comparableFieldsText} />
                                            </Field>
                                            <Field fullWidth label={"Location fields"}>
                                                <Textarea onChange={(event) => { setLocationFieldsText(event.target.value); }} rows={4} value={locationFieldsText} />
                                            </Field>
                                            <Field fullWidth label={"Type fields"}>
                                                <Textarea onChange={(event) => { setTypeFieldsText(event.target.value); }} rows={4} value={typeFieldsText} />
                                            </Field>
                                            <Field fullWidth hint={"Pause automation by source only; property-level pauses are intentionally avoided."} label={"Paused sources"}>
                                                <MultiSelect
                                                    onChange={(values) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, paused_source_ids: values } })); }}
                                                    options={(sourcesQuery.data ?? []).map((source) => ({ label: source.name, value: source.id }))}
                                                    placeholder={"Pause selected sources"}
                                                    values={workspaceSettings.operations.paused_source_ids}
                                                />
                                            </Field>
                                            <Field fullWidth hint={"Pause automation by tag for operational control across related properties."} label={"Paused tags"}>
                                                <MultiSelect
                                                    onChange={(values) => { setWorkspaceSettings((current) => ({ ...current, operations: { ...current.operations, paused_tag_ids: values } })); }}
                                                    options={(tagsQuery.data ?? []).map((tag) => ({ label: tag.name, value: tag.id }))}
                                                    placeholder={"Pause selected tags"}
                                                    values={workspaceSettings.operations.paused_tag_ids}
                                                />
                                            </Field>
                                            <ActionGroup>
                                                <Button type={"submit"}>{"Save operations settings"}</Button>
                                            </ActionGroup>
                                        </FormGrid>
                                    </PageCard>
                                </PageStack>
                            ),
                        },
                        {
                            id: "data",
                            label: "Recovery & Data Movement",
                            panel: (
                                <PageStack>
                                    <PageCard description={"Recovery and data movement controls live in Settings and stay separate from daily workflows."} title={"Recovery & Data Movement"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Exports"} value={"Use backend-supported exports when available."} />
                                            <KeyValuePair label={"Imports"} value={"Validate data before importing into tracked properties."} />
                                            <KeyValuePair label={"Recovery"} value={"Keep recovery actions behind explicit confirmations."} />
                                        </KeyValueGrid>
                                    </PageCard>
                                </PageStack>
                            ),
                        },
                    ]}
                />
            </PageCard>
        </PageStack>
    );
};
