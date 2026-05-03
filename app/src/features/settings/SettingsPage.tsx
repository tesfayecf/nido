import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextualHelp } from "@/components/ui/ContextualHelp";
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
import { useToast } from "@/components/ui/ToastProvider";
import { applyThemePreference, getStoredThemePreference, THEME_STORAGE_KEY } from "@/hooks/useTheme";
import { formatDateTime } from "@/lib/format/date";
import { createWorkspaceBackupFile, downloadWorkspaceBackupData, getMigrationStatus, listWorkspaceBackupFiles, resetWorkspaceData, restoreWorkspaceBackupData } from "@/services/backup/backup.service";
import { authKeys } from "@/services/auth/auth.keys";
import { changePassword, getCurrentUser, updateProfile } from "@/services/auth/auth.service";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { PREFERENCE_STORAGE_KEY } from "@/features/settings/localPreferences";
import { getPlatformSettings, updatePlatformSettings } from "@/services/platform/platform.service";
import type { PlatformSettings } from "@/services/platform/platform.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { listTags } from "@/services/tags/tags.service";

import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    FULL_SETTINGS_BACKUP_VERSION,
    LEGACY_SETTINGS_BACKUP_VERSION,
    buildWorkspaceBackupFile,
    normalizeNotificationPreferences,
    parseImportedBackup,
    type ImportedBackup,
    type LocalSettingsBackupData,
    type NotificationPreferencesDraft,
} from "@/features/settings/settingsBackup";
import {
    DEFAULT_WORKSPACE_SETTINGS,
    readWorkspaceSettings,
    saveWorkspaceSettings,
    WORKSPACE_SETTINGS_STORAGE_KEY,
    type WorkspaceSettings,
} from "@/features/settings/workspaceSettings";

const LOCAL_UI_STORAGE_KEYS = ["nido.bookmark-groups", "nido.nav-collapsed", "nido.properties.table"];

const DISPLAY_PRESETS = [
    { currency: "EUR", label: "Ireland", locale: "en-IE" },
    { currency: "EUR", label: "Spain", locale: "es-ES" },
    { currency: "USD", label: "United States", locale: "en-US" },
] as const;

const NOTIFICATION_CHANNEL_PRESETS = [
    { channels: ["in-app"], label: "In-app only" },
    { channels: ["in-app", "email"], label: "Standard" },
    { channels: ["in-app", "email", "webhook", "chat"], label: "All channels" },
] as const;

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
    const platformSettingsQuery = useQuery({
        queryFn: getPlatformSettings,
        queryKey: ["platform", "settings"],
    });
    const migrationStatusQuery = useQuery({
        queryFn: getMigrationStatus,
        queryKey: ["platform", "migration-status"],
    });
    const backupFilesQuery = useQuery({
        queryFn: listWorkspaceBackupFiles,
        queryKey: ["platform", "backup-files"],
    });

    const [displayName, setDisplayName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [preferences, setPreferences] = useState<NotificationPreferencesDraft>(DEFAULT_NOTIFICATION_PREFERENCES);
    const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => readWorkspaceSettings());
    const [pendingBackupImport, setPendingBackupImport] = useState<{ backup: ImportedBackup; fileName: string; } | null>(null);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetAppOpen, setResetAppOpen] = useState(false);
    const [platformSettingsDraft, setPlatformSettingsDraft] = useState<PlatformSettings | null>(null);
    const backupFileInputRef = useRef<HTMLInputElement | null>(null);

    const syncWorkspaceSettingsDraft = (nextSettings: WorkspaceSettings): void => {
        setWorkspaceSettings(nextSettings);
    };

    const setDisplayDensity = (density: WorkspaceSettings["preferences"]["density"]): void => {
        setWorkspaceSettings((current) => ({
            ...current,
            preferences: {
                ...current.preferences,
                density,
            },
        }));
    };

    const applyDisplayPreset = (locale: string, currency: string): void => {
        setWorkspaceSettings((current) => ({
            ...current,
            preferences: {
                ...current.preferences,
                display_currency: currency,
                display_locale: locale,
            },
        }));
    };

    const applyNotificationChannelPreset = (channels: string[]): void => {
        setPreferences((current) => ({
            ...current,
            channels,
        }));
    };

    useEffect(() => {
        if (meQuery.data !== undefined) {
            setDisplayName(meQuery.data.display_name);
        }
    }, [meQuery.data]);

    useEffect(() => {
        if (platformSettingsQuery.data !== undefined) {
            setPlatformSettingsDraft(platformSettingsQuery.data);
        }
    }, [platformSettingsQuery.data]);

    useEffect(() => {
        const storedSettings = readWorkspaceSettings();
        syncWorkspaceSettingsDraft(storedSettings);

        const rawPreferences = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
        if (rawPreferences === null) {
            return;
        }

        try {
            setPreferences(normalizeNotificationPreferences(JSON.parse(rawPreferences)));
        } catch {
            setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
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

    const exportBackupMutation = useMutation({
        mutationFn: downloadWorkspaceBackupData,
        onError() {
            pushToast("Could not download the workspace backup.", "error");
        },
        onSuccess(workspaceData) {
            const backup = buildWorkspaceBackupFile({
                notification_preferences: preferences,
                theme_preference: getStoredThemePreference(),
                workspace_settings: workspaceSettings,
            }, workspaceData);
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `nido-backup-${backup.exported_at.replace(/[:.TZ]/gu, "-")}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
            pushToast("Backup downloaded.", "success");
        },
    });

    const restoreBackupMutation = useMutation({
        mutationFn: async (pendingImport: { backup: ImportedBackup; fileName: string; }) => {
            if (pendingImport.backup.kind === "full") {
                await restoreWorkspaceBackupData(pendingImport.backup.workspace_data);
            }

            return pendingImport;
        },
        onError() {
            pushToast("Could not restore the selected backup.", "error");
        },
        onSuccess(pendingImport) {
            applyLocalSettingsBackup(pendingImport.backup.local_settings);
            setPendingBackupImport(null);
            if (backupFileInputRef.current !== null) {
                backupFileInputRef.current.value = "";
            }

            pushToast(
                pendingImport.backup.kind === "full"
                    ? "Workspace backup restored."
                    : "Legacy settings backup restored on this device.",
                "success",
            );
        },
    });

    const createServerBackupMutation = useMutation({
        mutationFn: createWorkspaceBackupFile,
        onError() {
            pushToast("Could not create the server backup file.", "error");
        },
        onSuccess(file) {
            void queryClient.invalidateQueries({ queryKey: ["platform", "backup-files"] });
            pushToast(`Server backup created: ${file.name}`, "success");
        },
    });

    const resetWorkspaceMutation = useMutation({
        mutationFn: resetWorkspaceData,
        onError() {
            pushToast("Could not reset the application.", "error");
        },
        onSuccess() {
            resetLocalSettings();
            setResetAppOpen(false);
            pushToast("Application reset to its initial state.", "success");
        },
    });

    const passwordMismatch = newPassword !== "" && newPassword !== confirmPassword;
    const passwordsReady =
        currentPassword.trim() !== "" &&
        newPassword.trim() !== "" &&
        !passwordMismatch &&
        newPassword.length >= 8;
    const saveWeeklyDigestMutation = useMutation({
        mutationFn: async () => {
            if (platformSettingsDraft === null) {
                throw new Error("Platform settings have not loaded yet.");
            }

            return updatePlatformSettings(platformSettingsDraft);
        },
        onError() {
            pushToast("Could not save weekly email digest settings.", "error");
        },
        onSuccess(nextSettings) {
            setPlatformSettingsDraft(nextSettings);
            pushToast("Weekly digest settings saved.", "success");
        },
    });

    const savePreferences = (): void => {
        window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preferences));
        pushToast("Notification preferences saved on this device.", "success");
    };

    const persistWorkspaceSettings = (): void => {
        syncWorkspaceSettingsDraft(workspaceSettings);
        saveWorkspaceSettings(workspaceSettings);
        pushToast("Workspace settings applied immediately on this device.", "success");
    };

    const applyLocalSettingsBackup = (backup: LocalSettingsBackupData): void => {
        syncWorkspaceSettingsDraft(backup.workspace_settings);
        setPreferences(backup.notification_preferences);
        saveWorkspaceSettings(backup.workspace_settings);
        window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(backup.notification_preferences));
        applyThemePreference(backup.theme_preference);
    };

    const handleBackupFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = event.target.files?.[0];
        if (file === undefined) {
            return;
        }

        try {
            const parsed = parseImportedBackup(JSON.parse(await file.text()));
            if (parsed === null) {
                event.target.value = "";
                pushToast("Backup file is not a supported Nido backup export.", "error");
                return;
            }

            setPendingBackupImport({ backup: parsed, fileName: file.name });
        } catch {
            event.target.value = "";
            pushToast("Could not read the selected backup file.", "error");
        }
    };

    const restoreBackup = (): void => {
        if (pendingBackupImport === null) {
            return;
        }

        restoreBackupMutation.mutate(pendingBackupImport);
    };

    const resetLocalSettings = (): void => {
        syncWorkspaceSettingsDraft(DEFAULT_WORKSPACE_SETTINGS);
        setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        saveWorkspaceSettings(DEFAULT_WORKSPACE_SETTINGS);
        window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES));
        applyThemePreference("system");
        window.localStorage.removeItem(THEME_STORAGE_KEY);
        window.localStorage.removeItem(WORKSPACE_SETTINGS_STORAGE_KEY);
        LOCAL_UI_STORAGE_KEYS.forEach((storageKey) => {
            window.localStorage.removeItem(storageKey);
        });
        setResetOpen(false);
        pushToast("Local settings reset to defaults.", "success");
    };

    return (
        <PageStack>
            <PageCard
                description={"Keep price evaluation defaults, property intake behavior, and recovery/data movement controls clearly separated."}
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
                                                    {"Save profile"}
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
                                            className={"settings-preferences-form"}
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                persistWorkspaceSettings();
                                                savePreferences();
                                            }}
                                        >
                                            <div className={"settings-preferences-layout"}>
                                                <section className={"settings-preferences-panel"}>
                                                    <div className={"settings-preferences-panel__header"}>
                                                        <div>
                                                            <span className={"app-shell__eyebrow"}>{"Display"}</span>
                                                            <div className={"settings-preferences-panel__title-row"}>
                                                                <h3 className={"settings-preferences-panel__title"}>{"Workspace view"}</h3>
                                                                <ContextualHelp content={"Keep formatting and density close to the presets you use most often."} title={"Workspace view"} />
                                                            </div>
                                                        </div>
                                                        <ActionGroup className={"settings-preferences-panel__actions"}>
                                                            {DISPLAY_PRESETS.map((preset) => {
                                                                const isActive = workspaceSettings.preferences.display_locale === preset.locale
                                                                    && workspaceSettings.preferences.display_currency === preset.currency;
                                                                return (
                                                                    <Button
                                                                        aria-label={`Apply ${preset.label} display preset`}
                                                                        key={preset.label}
                                                                        onClick={() => { applyDisplayPreset(preset.locale, preset.currency); }}
                                                                        size={"small"}
                                                                        variant={isActive ? "primary" : "secondary"}
                                                                    >
                                                                        {preset.label}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </ActionGroup>
                                                    </div>
                                                    <FormGrid as={"div"} className={"settings-preferences-panel__fields"} variant={"two-column"}>
                                                        <Field fullWidth label={"Display density"}>
                                                            <div className={"settings-preferences-density"}>
                                                                <Button onClick={() => { setDisplayDensity("comfortable"); }} size={"small"} variant={workspaceSettings.preferences.density === "comfortable" ? "primary" : "secondary"}>{"Comfortable"}</Button>
                                                                <Button onClick={() => { setDisplayDensity("compact"); }} size={"small"} variant={workspaceSettings.preferences.density === "compact" ? "primary" : "secondary"}>{"Compact"}</Button>
                                                            </div>
                                                        </Field>
                                                        <Field dense hint={"BCP 47 locale, for example en-IE or es-ES."} label={"Display locale"}>
                                                            <Input onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, preferences: { ...current.preferences, display_locale: event.target.value } })); }} value={workspaceSettings.preferences.display_locale} />
                                                        </Field>
                                                        <Field dense hint={"ISO currency code, for example EUR or USD."} label={"Display currency"}>
                                                            <Input maxLength={3} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, preferences: { ...current.preferences, display_currency: event.target.value.toUpperCase().slice(0, 3) } })); }} value={workspaceSettings.preferences.display_currency} />
                                                        </Field>
                                                    </FormGrid>
                                                </section>

                                                <section className={"settings-preferences-panel"}>
                                                    <div className={"settings-preferences-panel__header"}>
                                                        <div>
                                                            <span className={"app-shell__eyebrow"}>{"Pricing"}</span>
                                                            <div className={"settings-preferences-panel__title-row"}>
                                                                <h3 className={"settings-preferences-panel__title"}>{"Deal evaluation"}</h3>
                                                                <ContextualHelp content={"Adjust how aggressively the workspace labels listings as cheap or expensive."} title={"Deal evaluation"} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <FormGrid as={"div"} className={"settings-preferences-panel__fields"} variant={"two-column"}>
                                                        <Field dense hint={"Listings below this percentage gap are marked cheap."} label={"Cheap threshold (%)"}>
                                                            <Input min={0} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, thresholds: { ...current.thresholds, cheap_below_percent: Number(event.target.value) || 0 } })); }} type={"number"} value={workspaceSettings.thresholds.cheap_below_percent} />
                                                        </Field>
                                                        <Field dense hint={"Listings above this percentage gap are marked expensive."} label={"Expensive threshold (%)"}>
                                                            <Input min={0} onChange={(event) => { setWorkspaceSettings((current) => ({ ...current, thresholds: { ...current.thresholds, expensive_above_percent: Number(event.target.value) || 0 } })); }} type={"number"} value={workspaceSettings.thresholds.expensive_above_percent} />
                                                        </Field>
                                                    </FormGrid>
                                                </section>

                                                <section className={"settings-preferences-panel settings-preferences-panel--wide"}>
                                                    <div className={"settings-preferences-panel__header"}>
                                                        <div>
                                                            <span className={"app-shell__eyebrow"}>{"Notifications"}</span>
                                                            <div className={"settings-preferences-panel__title-row"}>
                                                                <h3 className={"settings-preferences-panel__title"}>{"Personal delivery"}</h3>
                                                                <ContextualHelp content={"Keep the most common notification combinations one click away and reduce scanning fatigue."} title={"Personal delivery"} />
                                                            </div>
                                                        </div>
                                                        <ActionGroup className={"settings-preferences-panel__actions"}>
                                                            {NOTIFICATION_CHANNEL_PRESETS.map((preset) => {
                                                                const isActive = preset.channels.length === preferences.channels.length
                                                                    && preset.channels.every((channel) => preferences.channels.includes(channel));
                                                                return (
                                                                    <Button
                                                                        aria-label={`Apply ${preset.label.toLowerCase()} notification preset`}
                                                                        key={preset.label}
                                                                        onClick={() => { applyNotificationChannelPreset([...preset.channels]); }}
                                                                        size={"small"}
                                                                        variant={isActive ? "primary" : "secondary"}
                                                                    >
                                                                        {preset.label}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </ActionGroup>
                                                    </div>
                                                    <FormGrid as={"div"} className={"settings-preferences-panel__fields"} variant={"two-column"}>
                                                        <Field dense hint={"Start muting lower-priority alerts at this time."} label={"Quiet hours start"}>
                                                            <Input onChange={(event) => { setPreferences((current) => ({ ...current, quietHoursStart: event.target.value })); }} type={"time"} value={preferences.quietHoursStart} />
                                                        </Field>
                                                        <Field dense hint={"Resume standard alerts after this time."} label={"Quiet hours end"}>
                                                            <Input onChange={(event) => { setPreferences((current) => ({ ...current, quietHoursEnd: event.target.value })); }} type={"time"} value={preferences.quietHoursEnd} />
                                                        </Field>
                                                        <Field className={"field--checkbox-compact"} hint={"Batch lower-priority notifications into a digest when enabled."} label={"Digest mode"} variant={"checkbox"}>
                                                            <input checked={preferences.digestMode} onChange={(event) => { setPreferences((current) => ({ ...current, digestMode: event.target.checked })); }} type={"checkbox"} />
                                                        </Field>
                                                        <Field dense hint={"Ignore alerts below this urgency."} label={"Minimum severity"}>
                                                            <Select onChange={(event) => { setPreferences((current) => ({ ...current, severityFloor: event.target.value })); }} value={preferences.severityFloor}>
                                                                <option value={"low"}>{"Low"}</option>
                                                                <option value={"medium"}>{"Medium"}</option>
                                                                <option value={"high"}>{"High"}</option>
                                                                <option value={"critical"}>{"Critical"}</option>
                                                            </Select>
                                                        </Field>
                                                        <Field hint={"Pick where personal alerts should arrive."} label={"Delivery channels"}>
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
                                                        <Field hint={"Muted tags stay out of your personal notifications."} label={"Muted tags"}>
                                                            <MultiSelect
                                                                onChange={(values) => { setPreferences((current) => ({ ...current, mutedTagIds: values })); }}
                                                                options={(tagsQuery.data ?? []).map((tag) => ({ label: tag.name, value: tag.id }))}
                                                                placeholder={"Mute selected tags"}
                                                                values={preferences.mutedTagIds}
                                                            />
                                                        </Field>
                                                        <ActionGroup>
                                                            <Button onClick={() => { setPreferences((current) => ({ ...current, mutedTagIds: [] })); }} size={"small"} variant={"ghost"}>{"Clear muted tags"}</Button>
                                                        </ActionGroup>
                                                    </FormGrid>
                                                </section>
                                            </div>
                                            <div className={"settings-preferences-footer"}>
                                                <div className={"settings-preferences-footer__help"}>
                                                    <span className={"muted-copy"}>{"Saved locally"}</span>
                                                    <ContextualHelp content={"Workspace formatting and personal notifications are saved together on this device."} title={"Preference storage"} />
                                                </div>
                                                <ActionGroup>
                                                    <Button type={"submit"}>{"Save preferences"}</Button>
                                                </ActionGroup>
                                            </div>
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
                                    <PageCard description={"Field mapping and candidate review now live on a dedicated page so runtime controls stay separate."} title={"Field Candidates"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Suggested fields"} value={"Review active, ignored, and mapped candidates in one focused workflow."} />
                                            <KeyValuePair label={"Accepted fields"} value={"Keep canonical mappings away from pause and retry controls."} />
                                        </KeyValueGrid>
                                        <ActionGroup>
                                            <Button as={"a"} href={"/settings/field-candidates"} variant={"secondary"}>{"Open Field Candidates"}</Button>
                                        </ActionGroup>
                                    </PageCard>
                                    <PageCard description={"Keep the fast property flow lightweight while defining safe defaults for new automatic tracking."} title={"Property intake defaults"}>
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
                                            <ActionGroup>
                                                <Button type={"submit"}>{"Save intake defaults"}</Button>
                                            </ActionGroup>
                                        </FormGrid>
                                    </PageCard>
                                    <PageCard description={"Pause and resume runtime automation without mixing these controls with field configuration."} title={"Operational pause controls"}>
                                        <FormGrid
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                persistWorkspaceSettings();
                                            }}
                                        >
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
                                                <Button type={"submit"}>{"Save operational settings"}</Button>
                                            </ActionGroup>
                                        </FormGrid>
                                    </PageCard>
                                    <PageCard description={"Desktop digests run locally once per week when digest mode is enabled. Configure the optional email copy here."} title={"Weekly digest"}>
                                        <FormGrid
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                saveWeeklyDigestMutation.mutate();
                                            }}
                                        >
                                            {platformSettingsQuery.isError ? <ErrorBanner>{"Could not load weekly digest settings."}</ErrorBanner> : null}
                                            <Field hint={"Desktop notifications use the local digest setting above. Enable this only if SMTP delivery is configured."} label={"Send weekly email digest"} variant={"checkbox"}>
                                                <input
                                                    checked={platformSettingsDraft?.email_digest.enabled ?? false}
                                                    onChange={(event) => {
                                                        setPlatformSettingsDraft((current) => current === null ? current : {
                                                            ...current,
                                                            email_digest: {
                                                                ...current.email_digest,
                                                                enabled: event.target.checked,
                                                            },
                                                        });
                                                    }}
                                                    type={"checkbox"}
                                                />
                                            </Field>
                                            <Field label={"Digest recipient"}>
                                                <Input
                                                    onChange={(event) => {
                                                        setPlatformSettingsDraft((current) => current === null ? current : {
                                                            ...current,
                                                            email_digest: {
                                                                ...current.email_digest,
                                                                recipient: event.target.value,
                                                            },
                                                        });
                                                    }}
                                                    placeholder={"owner@example.com"}
                                                    value={platformSettingsDraft?.email_digest.recipient ?? ""}
                                                />
                                            </Field>
                                            <Field label={"Send after (UTC)"}>
                                                <Input
                                                    onChange={(event) => {
                                                        setPlatformSettingsDraft((current) => current === null ? current : {
                                                            ...current,
                                                            email_digest: {
                                                                ...current.email_digest,
                                                                schedule: event.target.value,
                                                            },
                                                        });
                                                    }}
                                                    type={"time"}
                                                    value={platformSettingsDraft?.email_digest.schedule ?? "09:00"}
                                                />
                                            </Field>
                                            <Field label={"Last sent"}>
                                                <Input disabled value={platformSettingsDraft?.email_digest.last_sent_at === undefined ? "Never" : formatDateTime(platformSettingsDraft.email_digest.last_sent_at)} />
                                            </Field>
                                            <ActionGroup>
                                                <Button isLoading={saveWeeklyDigestMutation.isPending} type={"submit"}>{"Save weekly digest"}</Button>
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
                                <PageStack className={"settings-data-movement"}>
                                    <PageCard description={"Create a portable workspace backup before major changes, restore it with one upload, and keep destructive resets behind confirmations."} title={"Recovery & Data Movement"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Download backup"} value={"Export properties, sources, tags, relationships, field definitions, platform settings, and this device’s local settings into one versioned JSON file."} />
                                            <KeyValuePair label={"Upload backup"} value={"Restore a full workspace backup or migrate a legacy local-settings backup without partial imports."} />
                                            <KeyValuePair label={"Conflict strategy"} value={"Full restores overwrite the current workspace data deterministically before local settings are applied."} />
                                        </KeyValueGrid>
                                    </PageCard>
                                    <PageCard description={"Download a full, portable snapshot before risky edits or environment changes."} title={"Download backup"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Includes"} value={"Properties, sources, tags, relationships, field definitions, platform settings, workspace settings, notification preferences, and theme preference"} />
                                            <KeyValuePair label={"Format"} value={`Versioned JSON backup v${FULL_SETTINGS_BACKUP_VERSION}`} />
                                        </KeyValueGrid>
                                        <ActionGroup className={"settings-data-movement__actions"}>
                                            <Button isLoading={exportBackupMutation.isPending} onClick={() => { exportBackupMutation.mutate(); }}>{"Download backup"}</Button>
                                        </ActionGroup>
                                    </PageCard>
                                    <PageCard description={"Server-side recovery files are persisted in /app/backups and survive container recreation when the backup volume is mounted."} title={"Server backup storage"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Migration state"} value={migrationStatusQuery.data === undefined ? "Loading" : `${migrationStatusQuery.data.state} (${migrationStatusQuery.data.current_version} → ${migrationStatusQuery.data.target_version})`} />
                                            <KeyValuePair label={"Strategy"} value={migrationStatusQuery.data?.strategy ?? "safe-auto"} />
                                            <KeyValuePair label={"Latest pre-migration backup"} value={migrationStatusQuery.data?.backup_path ?? "None recorded for this process"} />
                                            <KeyValuePair label={"Stored files"} value={`${backupFilesQuery.data?.length ?? 0} backup file(s) available`} />
                                        </KeyValueGrid>
                                        {migrationStatusQuery.data?.error !== undefined ? <ErrorBanner>{migrationStatusQuery.data.error}</ErrorBanner> : null}
                                        <ActionGroup className={"settings-data-movement__actions"}>
                                            <Button isLoading={createServerBackupMutation.isPending} onClick={() => { createServerBackupMutation.mutate(); }} variant={"secondary"}>{"Create server backup"}</Button>
                                        </ActionGroup>
                                    </PageCard>
                                    <PageCard description={"Upload a backup to restore the full workspace or recover a legacy device-only export."} title={"Upload backup"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Supported backup"} value={`Nido backup v${FULL_SETTINGS_BACKUP_VERSION} and legacy local-settings backup v${LEGACY_SETTINGS_BACKUP_VERSION}`} />
                                            <KeyValuePair label={"Restore behavior"} value={"Full restores overwrite workspace data and then apply local settings on this device."} />
                                        </KeyValueGrid>
                                        <input accept={"application/json,.json"} hidden onChange={(event) => { void handleBackupFileChange(event); }} ref={backupFileInputRef} type={"file"} />
                                        <ActionGroup className={"settings-data-movement__actions"}>
                                            <Button onClick={() => { backupFileInputRef.current?.click(); }} variant={"secondary"}>{"Upload backup"}</Button>
                                        </ActionGroup>
                                    </PageCard>
                                    <PageCard description={"Remove custom local settings and return this browser to the default Nido setup."} title={"Reset local settings"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Resets"} value={"Workspace settings, notification preferences, theme, saved table layout, bookmarks groups, and nav state"} />
                                            <KeyValuePair label={"Does not remove"} value={"Tracked properties, source templates, runs, tags, or server-side account data"} />
                                        </KeyValueGrid>
                                        <ActionGroup>
                                            <Button onClick={() => { setResetOpen(true); }} variant={"destructive"}>{"Reset local settings"}</Button>
                                        </ActionGroup>
                                    </PageCard>
                                    <PageCard description={"Deletes server-side workspace data and resets this browser to defaults. Create a backup first if you may need to recover."} title={"Reset application"}>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Deletes"} value={"Properties, sources, runs, tags, platform settings, users, sessions, alerts, notifications, and local settings"} />
                                            <KeyValuePair label={"Safety"} value={"Requires confirmation and runs as one backend transaction"} />
                                        </KeyValueGrid>
                                        <ActionGroup>
                                            <Button onClick={() => { setResetAppOpen(true); }} variant={"destructive"}>{"Reset application"}</Button>
                                        </ActionGroup>
                                    </PageCard>
                                </PageStack>
                            ),
                        },
                    ]}
                />
            </PageCard>
            <ConfirmDialog
                confirmLabel={pendingBackupImport?.backup.kind === "full" ? "Restore workspace backup" : "Restore settings backup"}
                description={pendingBackupImport === null
                    ? ""
                    : pendingBackupImport.backup.kind === "full"
                        ? `Restore "${pendingBackupImport.fileName}"? This overwrites the current properties, sources, tags, relationships, field definitions, platform settings, and local settings.`
                        : `Restore legacy settings from "${pendingBackupImport.fileName}" on this device? This replaces the current local settings, notification preferences, and theme.`}
                isPending={restoreBackupMutation.isPending}
                onConfirm={restoreBackup}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingBackupImport(null);
                        if (backupFileInputRef.current !== null) {
                            backupFileInputRef.current.value = "";
                        }
                    }
                }}
                open={pendingBackupImport !== null}
                title={pendingBackupImport?.backup.kind === "full" ? "Restore workspace backup" : "Restore settings backup"}
            />
            <ConfirmDialog
                confirmLabel={"Reset local settings"}
                description={"Reset this device to the default Nido settings? This removes local customizations and saved UI state, but it does not delete tracked properties or other server-side data."}
                onConfirm={resetLocalSettings}
                onOpenChange={setResetOpen}
                open={resetOpen}
                title={"Reset local settings"}
            />
            <ConfirmDialog
                confirmLabel={"Reset application"}
                description={"Reset the entire application? This deletes server-side workspace data, users, sessions, alerts, notifications, and local settings. Download or create a backup before continuing."}
                isPending={resetWorkspaceMutation.isPending}
                onConfirm={() => { resetWorkspaceMutation.mutate(); }}
                onOpenChange={setResetAppOpen}
                open={resetAppOpen}
                title={"Reset application"}
            />
        </PageStack>
    );
};
