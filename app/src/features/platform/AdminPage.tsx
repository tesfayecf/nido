import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { createAlertRule, listAlertRules } from "@/services/alert-rules/alert-rules.service";
import type { AlertRule } from "@/services/alert-rules/alert-rules.types";
import { upsertSource, listSources } from "@/services/backoffice-sources/sources.service";
import type { Source } from "@/services/backoffice-sources/sources.types";
import { formatDateTime } from "@/lib/format/date";
import { listNotifications } from "@/services/notifications/notifications.service";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { platformKeys } from "@/services/platform/platform.keys";
import { getPlatformSettings, getPlatformSummary, listIntegrationDeliveries, testPlatformChannel, updatePlatformSettings } from "@/services/platform/platform.service";
import type { PlatformSettings } from "@/services/platform/platform.types";
import { propertyKeys } from "@/services/properties/properties.keys";
import { createProperty, listProperties, updateProperty } from "@/services/properties/properties.service";
import type { Property, PropertyUpsertRequest } from "@/services/properties/properties.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { createTag, listPropertyTags, listTags, setPropertyTags } from "@/services/tags/tags.service";
import type { Tag } from "@/services/tags/tags.types";

const EVENT_OPTIONS = [
    "*",
    "notification.created",
    "property.created",
    "property.updated",
    "property.run.completed",
    "property.run.failed",
    "run.started",
    "run.completed",
    "run.failed",
];

interface BackupPayload {
    readonly alerts: { readonly property_url: string; readonly rule_type: string; readonly threshold_amount?: number; }[];
    readonly notifications: unknown[];
    readonly platform_settings: PlatformSettings;
    readonly properties: Property[];
    readonly property_tags: Record<string, string[]>;
    readonly sources: Source[];
    readonly tags: Tag[];
    readonly version: number;
}

type PropertyImportRow = PropertyUpsertRequest;

const DEFAULT_SETTINGS: PlatformSettings = {
    email_digest: { enabled: false, events: ["run.failed", "notification.created"], recipient: "", schedule: "09:00" },
    id: "platform",
    maintenance_window_enabled: false,
    maintenance_window_end: "05:00",
    maintenance_window_start: "02:00",
    scheduler_enabled: true,
    slack: { events: ["run.failed"] },
    spreadsheet: { events: ["property.run.completed"] },
    task_system: { events: ["run.failed"] },
    webhook: { events: ["notification.created", "run.failed"] },
};

export const AdminPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(DEFAULT_SETTINGS);
    const [importMode, setImportMode] = useState("properties-csv");
    const [importText, setImportText] = useState("");
    const [importPreview, setImportPreview] = useState("");
    const [selectedSourceId, setSelectedSourceId] = useState("");
    const [selectedTagId, setSelectedTagId] = useState("");

    const settingsQuery = useQuery({ queryFn: getPlatformSettings, queryKey: platformKeys.settings() });
    const summaryQuery = useQuery({ queryFn: getPlatformSummary, queryKey: platformKeys.summary(), refetchInterval: 10_000 });
    const deliveriesQuery = useQuery({ queryFn: () => listIntegrationDeliveries(30), queryKey: platformKeys.deliveries() });
    const propertiesQuery = useQuery({ queryFn: () => listProperties(), queryKey: propertyKeys.list() });
    const tagsQuery = useQuery({ queryFn: listTags, queryKey: tagKeys.list() });
    const sourcesQuery = useQuery({ queryFn: listSources, queryKey: ["sources"] });
    const alertsQuery = useQuery({ queryFn: listAlertRules, queryKey: ["alert-rules"] });
    const notificationsQuery = useQuery({ queryFn: () => listNotifications({ limit: 100, unread_only: false }), queryKey: notificationKeys.list({ limit: 100, unread_only: false }) });
    const propertyTagQueries = useQueries({
        queries: (propertiesQuery.data ?? []).map((property) => ({ queryFn: () => listPropertyTags(property.id), queryKey: tagKeys.propertyTags(property.id) })),
    });

    useEffect(() => {
        if (settingsQuery.data !== undefined) {
            setSettingsDraft(settingsQuery.data);
        }
    }, [settingsQuery.data]);

    const propertyTagsById = useMemo(() => {
        const map = new Map<string, string[]>();
        (propertiesQuery.data ?? []).forEach((property, index) => {
            map.set(property.id, (propertyTagQueries[index]?.data ?? []).map((tag) => tag.id));
        });
        return map;
    }, [propertiesQuery.data, propertyTagQueries]);

    const settingsMutation = useMutation({
        mutationFn: () => updatePlatformSettings(settingsDraft),
        onError() { pushToast("Could not save platform settings.", "error"); },
        onSuccess(data) {
            setSettingsDraft(data);
            void queryClient.invalidateQueries({ queryKey: platformKeys.settings() });
            void queryClient.invalidateQueries({ queryKey: platformKeys.summary() });
            pushToast("Platform settings saved.", "success");
        },
    });

    const testChannelMutation = useMutation({
        mutationFn: (channel: string) => testPlatformChannel(channel),
        onError() { pushToast("Could not send test integration event.", "error"); },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: platformKeys.deliveries() });
            pushToast("Integration test sent.", "success");
        },
    });

    const pauseGroupMutation = useMutation({
        mutationFn: async (paused: boolean) => {
            const matchingProperties = (propertiesQuery.data ?? []).filter((property) => {
                const matchesSource = selectedSourceId === "" || property.source_id === selectedSourceId;
                const matchesTag = selectedTagId === "" || (propertyTagsById.get(property.id) ?? []).includes(selectedTagId);
                return matchesSource && matchesTag;
            });
            for (const property of matchingProperties) {
                const payload: PropertyUpsertRequest = {
                    label: property.label,
                    metadata: property.metadata,
                    pause_reason: paused ? "Paused from admin controls" : "",
                    paused,
                    retry_backoff_millis: property.retry_backoff_millis,
                    retry_max_attempts: property.retry_max_attempts,
                    schedule_interval_seconds: property.schedule_interval_seconds,
                    source_id: property.source_id,
                    url: property.url,
                };
                await updateProperty(property.id, payload);
            }
        },
        onError() { pushToast("Could not update matching properties.", "error"); },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            void queryClient.invalidateQueries({ queryKey: platformKeys.summary() });
            pushToast("Operational controls applied.", "success");
        },
    });

    const handleImportFile = async (file: File | null): Promise<void> => {
        if (file === null) {
            return;
        }

        const text = await file.text();
        setImportText(text);
        try {
            if (importMode === "properties-csv") {
                const rows = parsePropertyCSV(text);
                setImportPreview(`Validated ${rows.length} property rows.`);
                return;
            }

            if (importMode === "templates-json") {
                const rows = JSON.parse(text) as Source[];
                setImportPreview(`Validated ${rows.length} source templates.`);
                return;
            }

            if (importMode === "alerts-json") {
                const rows = JSON.parse(text) as AlertRule[];
                setImportPreview(`Validated ${rows.length} alert rules.`);
                return;
            }

            const payload = JSON.parse(text) as BackupPayload;
            setImportPreview(`Validated backup with ${payload.properties.length} properties, ${payload.sources.length} templates, ${payload.tags.length} tags, and ${payload.alerts.length} alerts.`);
        } catch (error) {
            setImportPreview(error instanceof Error ? error.message : "Could not validate import file.");
        }
    };

    const importMutation = useMutation({
        mutationFn: async () => {
            const propertiesByURL = new Map((propertiesQuery.data ?? []).map((property) => [property.url, property.id]));
            if (importMode === "properties-csv") {
                const rows = parsePropertyCSV(importText);
                for (const row of rows) {
                    await upsertPropertyFromImport(row, propertiesQuery.data ?? []);
                }

                return;
            }

            if (importMode === "templates-json") {
                const rows = JSON.parse(importText) as Source[];
                for (const row of rows) {
                    await upsertSource(row);
                }

                return;
            }

            if (importMode === "alerts-json") {
                const rows = JSON.parse(importText) as { readonly property_url?: string; readonly property_id?: string; readonly rule_type: string; readonly threshold_amount?: number; }[];
                for (const row of rows) {
                    const propertyId = row.property_id ?? (row.property_url !== undefined ? propertiesByURL.get(row.property_url) : undefined);
                    if (propertyId === undefined) {
                        continue;
                    }

                    await createAlertRule({ property_id: propertyId, rule_type: row.rule_type, threshold_amount: row.threshold_amount });
                }

                return;
            }

            const payload = JSON.parse(importText) as BackupPayload;
            for (const tag of payload.tags) {
                if (!(tagsQuery.data ?? []).some((existingTag) => existingTag.name === tag.name)) {
                    await createTag({ color: tag.color, name: tag.name });
                }
            }

            for (const source of payload.sources) {
                await upsertSource(source);
            }

            const importedProperties = new Map<string, string>();
            for (const property of payload.properties) {
                const saved = await upsertPropertyFromImport(property, propertiesQuery.data ?? []);
                importedProperties.set(property.id, saved.id);
            }

            const currentTags = await listTags();
            for (const [propertyId, tagIds] of Object.entries(payload.property_tags)) {
                const resolvedPropertyId = importedProperties.get(propertyId);
                if (resolvedPropertyId === undefined) {
                    continue;
                }

                const currentTagIds = currentTags.filter((tag) => tagIds.includes(tag.id) || payload.tags.some((backupTag) => backupTag.id === tag.id && tag.name === backupTag.name)).map((tag) => tag.id);
                await setPropertyTags(resolvedPropertyId, currentTagIds);
            }

            for (const alert of payload.alerts) {
                const propertyId = propertiesByURL.get(alert.property_url);
                if (propertyId !== undefined) {
                    await createAlertRule({ property_id: propertyId, rule_type: alert.rule_type, threshold_amount: alert.threshold_amount });
                }
            }

            await updatePlatformSettings(payload.platform_settings);
        },
        onError() { pushToast("Import failed.", "error"); },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            void queryClient.invalidateQueries({ queryKey: ["sources"] });
            void queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
            void queryClient.invalidateQueries({ queryKey: tagKeys.list() });
            void queryClient.invalidateQueries({ queryKey: platformKeys.settings() });
            setImportText("");
            setImportPreview("");
            pushToast("Import completed.", "success");
        },
    });

    const exportPropertiesCSV = async (): Promise<void> => {
        const rows = (propertiesQuery.data ?? []).map((property) => ({
            acquisition_notes: property.metadata?.acquisition_notes ?? "",
            business_stage: property.metadata?.business_stage ?? "",
            deal_thesis: property.metadata?.deal_thesis ?? "",
            expected_rent: property.metadata?.expected_rent ?? "",
            expected_yield_bps: property.metadata?.expected_yield_bps ?? "",
            label: property.label,
            pause_reason: property.pause_reason ?? "",
            paused: property.paused ? "true" : "false",
            priority_level: property.metadata?.priority_level ?? "",
            source_id: property.source_id ?? "",
            target_price: property.metadata?.target_price ?? "",
            url: property.url,
        }));
        const header = Object.keys(rows[0] ?? { url: "", label: "", source_id: "" });
        const csv = [header.join(","), ...rows.map((row) => header.map((column) => escapeCSV(String(row[column as keyof typeof row] ?? ""))).join(","))].join("\n");
        downloadTextFile("properties-export.csv", csv, "text/csv;charset=utf-8");
    };

    const exportJSON = async (kind: "templates" | "alerts" | "backup"): Promise<void> => {
        if (kind === "templates") {
            downloadTextFile("source-templates.json", JSON.stringify(sourcesQuery.data ?? [], null, 2), "application/json");
            return;
        }

        if (kind === "alerts") {
            const propertiesById = new Map((propertiesQuery.data ?? []).map((property) => [property.id, property.url]));
            const payload = (alertsQuery.data ?? []).map((alert) => ({ ...alert, property_url: propertiesById.get(alert.property_id) }));
            downloadTextFile("alert-configurations.json", JSON.stringify(payload, null, 2), "application/json");
            return;
        }

        const propertyTags = Object.fromEntries((propertiesQuery.data ?? []).map((property) => [property.id, propertyTagsById.get(property.id) ?? []]));
        const backup: BackupPayload = {
            alerts: (alertsQuery.data ?? []).map((alert) => ({ property_url: (propertiesQuery.data ?? []).find((property) => property.id === alert.property_id)?.url ?? "", rule_type: alert.rule_type, threshold_amount: alert.threshold_amount })),
            notifications: notificationsQuery.data?.items ?? [],
            platform_settings: settingsDraft,
            properties: propertiesQuery.data ?? [],
            property_tags: propertyTags,
            sources: sourcesQuery.data ?? [],
            tags: tagsQuery.data ?? [],
            version: 1,
        };
        downloadTextFile(`workspace-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
    };

    const summary = summaryQuery.data;

    return (
        <PageStack>
            <PageCard description={"Advanced controls live here so the daily property workflow stays focused on evaluation, shortlisting, and analysis."} title={"Admin / Advanced"}>
                {summary === undefined ? <p className={"muted-copy"}>{"Loading platform summary..."}</p> : (
                    <KeyValueGrid compact>
                        <KeyValuePair label={"Scheduler"} value={<StatusBadge tone={summary.scheduler_enabled ? "success" : "neutral"} value={summary.scheduler_enabled ? "enabled" : "paused"} />} />
                        <KeyValuePair label={"Maintenance"} value={summary.maintenance_window_active ? "Active" : summary.maintenance_window_enabled ? "Scheduled" : "Off"} />
                        <KeyValuePair label={"Tracked properties"} value={`${summary.tracked_properties}`} />
                        <KeyValuePair label={"Paused properties"} value={`${summary.paused_properties}`} />
                        <KeyValuePair label={"Queue depth"} value={`${summary.queue_depth}`} />
                        <KeyValuePair label={"Success rate (24h)"} value={`${summary.success_rate.toFixed(1)}%`} />
                    </KeyValueGrid>
                )}
            </PageCard>

            <PageCard description={"Persist scheduler, maintenance-window, and integration behavior without exposing technical controls in the core workflow."} title={"Scheduling & Integrations"}>
                <FormGrid as={"div"} variant={"two-column"}>
                    <Field hint={"Stop scheduling new work immediately while preserving the current queue."} label={"Scheduler enabled"} variant={"checkbox"}>
                        <input checked={settingsDraft.scheduler_enabled} onChange={(event) => { setSettingsDraft((current) => ({ ...current, scheduler_enabled: event.target.checked })); }} type={"checkbox"} />
                    </Field>
                    <Field hint={"Automatically pause new work during this daily window."} label={"Maintenance window enabled"} variant={"checkbox"}>
                        <input checked={settingsDraft.maintenance_window_enabled} onChange={(event) => { setSettingsDraft((current) => ({ ...current, maintenance_window_enabled: event.target.checked })); }} type={"checkbox"} />
                    </Field>
                    <Field label={"Maintenance start"}><Input onChange={(event) => { setSettingsDraft((current) => ({ ...current, maintenance_window_start: event.target.value })); }} type={"time"} value={settingsDraft.maintenance_window_start ?? ""} /></Field>
                    <Field label={"Maintenance end"}><Input onChange={(event) => { setSettingsDraft((current) => ({ ...current, maintenance_window_end: event.target.value })); }} type={"time"} value={settingsDraft.maintenance_window_end ?? ""} /></Field>
                    <IntegrationFields channelKey={"webhook"} label={"Webhook"} settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} />
                    <IntegrationFields channelKey={"slack"} label={"Slack"} settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} />
                    <IntegrationFields channelKey={"spreadsheet"} label={"Spreadsheet sync"} settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} />
                    <IntegrationFields channelKey={"task_system"} label={"Task system"} settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} />
                    <Field label={"Digest recipient"}><Input onChange={(event) => { setSettingsDraft((current) => ({ ...current, email_digest: { ...current.email_digest, recipient: event.target.value } })); }} type={"email"} value={settingsDraft.email_digest.recipient ?? ""} /></Field>
                    <Field label={"Digest schedule"}><Input onChange={(event) => { setSettingsDraft((current) => ({ ...current, email_digest: { ...current.email_digest, schedule: event.target.value } })); }} type={"time"} value={settingsDraft.email_digest.schedule ?? "09:00"} /></Field>
                    <Field fullWidth hint={"Comma-separated event filters such as notification.created, run.failed, or *."} label={"Digest event filters"}>
                        <Textarea onChange={(event) => { setSettingsDraft((current) => ({ ...current, email_digest: { ...current.email_digest, events: parseEventList(event.target.value) } })); }} rows={3} value={(settingsDraft.email_digest.events ?? []).join(", ")} />
                    </Field>
                </FormGrid>
                <ActionGroup>
                    <Button disabled={settingsMutation.isPending} onClick={() => { settingsMutation.mutate(); }}>{settingsMutation.isPending ? "Saving..." : "Save settings"}</Button>
                    {(["webhook", "slack", "spreadsheet", "task"] as const).map((channel) => <Button disabled={testChannelMutation.isPending} key={channel} onClick={() => { testChannelMutation.mutate(channel); }} variant={"secondary"}>{`Test ${channel}`}</Button>)}
                </ActionGroup>
            </PageCard>

            <PageCard description={"Pause or resume slices of the portfolio by tag or source without editing every property individually."} title={"Portfolio Operations"}>
                <FormGrid as={"div"} variant={"two-column"}>
                    <Field label={"Source filter"}>
                        <Select onChange={(event) => { setSelectedSourceId(event.target.value); }} value={selectedSourceId}>
                            <option value={""}>{"All sources"}</option>
                            {(sourcesQuery.data ?? []).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                        </Select>
                    </Field>
                    <Field label={"Tag filter"}>
                        <Select onChange={(event) => { setSelectedTagId(event.target.value); }} value={selectedTagId}>
                            <option value={""}>{"All tags"}</option>
                            {(tagsQuery.data ?? []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                        </Select>
                    </Field>
                </FormGrid>
                <ActionGroup>
                    <Button disabled={pauseGroupMutation.isPending} onClick={() => { pauseGroupMutation.mutate(true); }} variant={"secondary"}>{"Pause matching properties"}</Button>
                    <Button disabled={pauseGroupMutation.isPending} onClick={() => { pauseGroupMutation.mutate(false); }}>{"Resume matching properties"}</Button>
                </ActionGroup>
            </PageCard>

            <PageCard description={"Move data in and out of the workspace with validation previews before persistence."} title={"Recovery & Data Movement"}>
                <ActionGroup>
                    <Button onClick={() => { void exportPropertiesCSV(); }} variant={"secondary"}>{"Export properties CSV"}</Button>
                    <Button onClick={() => { void exportJSON("templates"); }} variant={"secondary"}>{"Export templates"}</Button>
                    <Button onClick={() => { void exportJSON("alerts"); }} variant={"secondary"}>{"Export alerts"}</Button>
                    <Button onClick={() => { void exportJSON("backup"); }}>{"Create full backup"}</Button>
                </ActionGroup>
                <FormGrid as={"div"} variant={"two-column"}>
                    <Field label={"Import mode"}>
                        <Select onChange={(event) => { setImportMode(event.target.value); setImportPreview(""); setImportText(""); }} value={importMode}>
                            <option value={"properties-csv"}>{"Properties CSV"}</option>
                            <option value={"templates-json"}>{"Templates JSON"}</option>
                            <option value={"alerts-json"}>{"Alerts JSON"}</option>
                            <option value={"backup-json"}>{"Full backup JSON"}</option>
                        </Select>
                    </Field>
                    <Field label={"Upload file"}>
                        <Input accept={importMode === "properties-csv" ? ".csv" : ".json"} onChange={(event) => { void handleImportFile(event.target.files?.[0] ?? null); }} type={"file"} />
                    </Field>
                    <Field fullWidth label={"Validation preview"}>
                        <Textarea readOnly rows={4} value={importPreview} />
                    </Field>
                </FormGrid>
                <ActionGroup>
                    <Button disabled={importMutation.isPending || importText.trim() === "" || importPreview.startsWith("Could not") || importPreview.startsWith("Unexpected")} onClick={() => { importMutation.mutate(); }}>{importMutation.isPending ? "Importing..." : "Apply import"}</Button>
                </ActionGroup>
            </PageCard>

            <PageCard description={"Every integration attempt is logged so delivery failures never hide behind the core workflow."} title={"Delivery Log"}>
                {deliveriesQuery.data === undefined || deliveriesQuery.data.length === 0 ? <EmptyState message={"No integration activity has been recorded yet."} /> : (
                    <DataTable
                        caption={"Recent integration deliveries"}
                        columns={[
                            { cell: (item) => item.channel, header: "Channel", id: "channel" },
                            { cell: (item) => item.event_type, header: "Event", id: "event_type" },
                            { cell: (item) => <StatusBadge tone={item.status === "delivered" ? "success" : "danger"} value={item.status} />, header: "Status", id: "status" },
                            { cell: (item) => `${item.attempt_count}`, header: "Attempts", id: "attempts" },
                            { cell: (item) => item.target ?? "—", header: "Target", id: "target" },
                            { cell: (item) => item.created_at !== undefined ? formatDateTime(item.created_at) : "—", header: "Created", id: "created_at" },
                            { cell: (item) => item.error_message ?? "—", header: "Error", id: "error" },
                        ]}
                        compact
                        emptyMessage={"No integration deliveries recorded yet."}
                        getRowId={(item) => item.id}
                        items={deliveriesQuery.data}
                        pageSize={10}
                    />
                )}
            </PageCard>

            {settingsQuery.isError || summaryQuery.isError || deliveriesQuery.isError ? <ErrorBanner>{"Some admin data could not be loaded."}</ErrorBanner> : null}
        </PageStack>
    );
};

interface IntegrationFieldsProps {
    readonly channelKey: "webhook" | "slack" | "spreadsheet" | "task_system";
    readonly label: string;
    readonly setSettingsDraft: Dispatch<SetStateAction<PlatformSettings>>;
    readonly settingsDraft: PlatformSettings;
}

const IntegrationFields = ({ channelKey, label, setSettingsDraft, settingsDraft }: IntegrationFieldsProps): JSX.Element => {
    const channel = settingsDraft[channelKey];
    return (
        <>
            <Field label={`${label} URL`}>
                <Input onChange={(event) => { setSettingsDraft((current) => ({ ...current, [channelKey]: { ...current[channelKey], url: event.target.value } })); }} type={"url"} value={channel.url ?? ""} />
            </Field>
            <Field label={`${label} events`}>
                <Select onChange={(event) => { setSettingsDraft((current) => ({ ...current, [channelKey]: { ...current[channelKey], events: [event.target.value] } })); }} value={channel.events?.[0] ?? ""}>
                    {EVENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
            </Field>
        </>
    );
};

const parseEventList = (raw: string): string[] => {
    return raw.split(",").map((item) => item.trim()).filter((item) => item !== "");
};

const downloadTextFile = (filename: string, content: string, mimeType: string): void => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
};

const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes("\n") || value.includes('"')) {
        return `"${value.replace(/"/g, "\"\"")}"`;
    }

    return value;
};

const parsePropertyCSV = (text: string): PropertyImportRow[] => {
    const lines = text.trim().split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2) {
        throw new Error("Unexpected CSV payload.");
    }

    const header = parseCSVLine(lines[0] ?? "");
    return lines.slice(1).map((line) => {
        const values = parseCSVLine(line);
        const row = Object.fromEntries(header.map((column, index) => [column, values[index] ?? ""]));
        return {
            label: row.label ?? "",
            metadata: {
                acquisition_notes: row.acquisition_notes || undefined,
                business_stage: row.business_stage || undefined,
                deal_thesis: row.deal_thesis || undefined,
                expected_rent: row.expected_rent !== "" ? Number(row.expected_rent) : undefined,
                expected_yield_bps: row.expected_yield_bps !== "" ? Number(row.expected_yield_bps) : undefined,
                priority_level: row.priority_level || undefined,
                target_price: row.target_price !== "" ? Number(row.target_price) : undefined,
            },
            pause_reason: row.pause_reason || undefined,
            paused: row.paused === "true",
            source_id: row.source_id || undefined,
            url: row.url ?? "",
        } satisfies PropertyImportRow;
    });
};

const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (char === "," && !inQuotes) {
            values.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    values.push(current);
    return values;
};

const upsertPropertyFromImport = async (row: PropertyImportRow, existingProperties: readonly Property[]): Promise<Property> => {
    const payload: PropertyUpsertRequest = {
        label: row.label,
        metadata: row.metadata,
        pause_reason: row.pause_reason,
        paused: row.paused,
        retry_backoff_millis: row.retry_backoff_millis,
        retry_max_attempts: row.retry_max_attempts,
        schedule_interval_seconds: row.schedule_interval_seconds,
        source_id: row.source_id,
        url: row.url,
    };
    const existing = existingProperties.find((property) => property.url === row.url);
    if (existing !== undefined) {
        return updateProperty(existing.id, payload);
    }

    return createProperty(payload);
};
