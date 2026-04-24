import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { propertyKeys } from "@/services/properties/properties.keys";
import { listProperties } from "@/services/properties/properties.service";
import { tagKeys } from "@/services/tags/tags.keys";
import { listTags } from "@/services/tags/tags.service";
import { workspaceKeys } from "@/services/workspace/workspace.keys";
import {
    createMaintenanceWindow,
    createSchedulerPause,
    deleteMaintenanceWindow,
    deleteSchedulerPause,
    exportProperties,
    exportWorkspace,
    getSystemHealth,
    importProperties,
    listIntegrationDeliveries,
    listIntegrations,
    listMaintenanceWindows,
    listSchedulerPauses,
    previewPropertyImport,
    restoreWorkspace,
    saveIntegration,
    testIntegration,
} from "@/services/workspace/workspace.service";
import type { WorkspaceExport } from "@/services/workspace/workspace.types";

const downloadBlob = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
};

export const AdminConsolePage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [integrationForm, setIntegrationForm] = useState({ active: true, kind: "webhook" as const, name: "", target: "" });
    const [pauseForm, setPauseForm] = useState<{ reason: string; scope_type: "property" | "source" | "tag"; scope_value: string; }>({ reason: "", scope_type: "property", scope_value: "" });
    const [maintenanceForm, setMaintenanceForm] = useState({ ends_at: "", name: "", reason: "", starts_at: "" });
    const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
    const [restoreJson, setRestoreJson] = useState("");

    const propertiesQuery = useQuery({ queryFn: () => listProperties(), queryKey: propertyKeys.list() });
    const sourcesQuery = useQuery({ queryFn: listSources, queryKey: sourceKeys.list() });
    const tagsQuery = useQuery({ queryFn: listTags, queryKey: tagKeys.list() });
    const healthQuery = useQuery({ queryFn: getSystemHealth, queryKey: workspaceKeys.admin() });
    const integrationsQuery = useQuery({ queryFn: listIntegrations, queryKey: workspaceKeys.integrations() });
    const deliveriesQuery = useQuery({ queryFn: listIntegrationDeliveries, queryKey: workspaceKeys.deliveries() });
    const pausesQuery = useQuery({ queryFn: listSchedulerPauses, queryKey: workspaceKeys.pauses() });
    const maintenanceQuery = useQuery({ queryFn: listMaintenanceWindows, queryKey: workspaceKeys.maintenance() });

    const saveIntegrationMutation = useMutation({
        mutationFn: () => saveIntegration(integrationForm),
        onSuccess() {
            setIntegrationForm({ active: true, kind: "webhook", name: "", target: "" });
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.integrations() });
            pushToast("Integration saved.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not save integration.", "error");
        },
    });

    const testIntegrationMutation = useMutation({
        mutationFn: (integrationId: string) => testIntegration(integrationId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.deliveries() });
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.integrations() });
            pushToast("Integration test sent.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not test integration.", "error");
        },
    });

    const createPauseMutation = useMutation({
        mutationFn: () => createSchedulerPause(pauseForm),
        onSuccess() {
            setPauseForm({ reason: "", scope_type: "property", scope_value: "" });
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.pauses() });
            pushToast("Pause created.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not create pause.", "error");
        },
    });

    const deletePauseMutation = useMutation({
        mutationFn: (pauseId: string) => deleteSchedulerPause(pauseId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.pauses() });
            pushToast("Pause removed.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not remove pause.", "error");
        },
    });

    const createMaintenanceMutation = useMutation({
        mutationFn: () => createMaintenanceWindow(maintenanceForm),
        onSuccess() {
            setMaintenanceForm({ ends_at: "", name: "", reason: "", starts_at: "" });
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.maintenance() });
            pushToast("Maintenance window created.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not create maintenance window.", "error");
        },
    });

    const deleteMaintenanceMutation = useMutation({
        mutationFn: (windowId: string) => deleteMaintenanceWindow(windowId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.maintenance() });
            pushToast("Maintenance window removed.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not remove maintenance window.", "error");
        },
    });

    const importPreviewMutation = useMutation({
        mutationFn: async () => {
            if (selectedImportFile === null) {
                throw new Error("Choose a CSV file first.");
            }

            return previewPropertyImport(selectedImportFile);
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not preview import.", "error");
        },
    });

    const importCommitMutation = useMutation({
        mutationFn: async () => {
            if (selectedImportFile === null) {
                throw new Error("Choose a CSV file first.");
            }

            return importProperties(selectedImportFile);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            pushToast("Property import completed.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not import properties.", "error");
        },
    });

    const exportPropertiesMutation = useMutation({
        mutationFn: exportProperties,
        onSuccess(blob) {
            downloadBlob(blob, "properties-export.csv");
            pushToast("Property export downloaded.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not export properties.", "error");
        },
    });

    const exportWorkspaceMutation = useMutation({
        mutationFn: exportWorkspace,
        onSuccess(payload) {
            downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "workspace-backup.json");
            pushToast("Workspace backup downloaded.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not export workspace.", "error");
        },
    });

    const parsedRestorePayload = useMemo(() => {
        try {
            return restoreJson.trim() === "" ? null : JSON.parse(restoreJson) as WorkspaceExport;
        } catch {
            return null;
        }
    }, [restoreJson]);

    const restorePreviewMutation = useMutation({
        mutationFn: () => {
            if (parsedRestorePayload === null) {
                throw new Error("Paste a valid backup JSON payload first.");
            }

            return restoreWorkspace(parsedRestorePayload, true);
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not validate backup.", "error");
        },
    });

    const restoreCommitMutation = useMutation({
        mutationFn: () => {
            if (parsedRestorePayload === null) {
                throw new Error("Paste a valid backup JSON payload first.");
            }

            return restoreWorkspace(parsedRestorePayload, false);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            pushToast("Workspace restore applied.", "success");
        },
        onError(error) {
            pushToast(error instanceof Error ? error.message : "Could not restore workspace.", "error");
        },
    });

    const pauseOptions = useMemo<{ label: string; value: string; }[]>(() => {
        switch (pauseForm.scope_type) {
            case "source":
                return sourcesQuery.data?.map((item) => ({ label: item.name, value: item.id })) ?? [];
            case "tag":
                return tagsQuery.data?.map((item) => ({ label: item.name, value: item.id })) ?? [];
            case "property":
            default:
                return propertiesQuery.data?.map((item) => ({ label: item.label, value: item.id })) ?? [];
        }
    }, [pauseForm.scope_type, propertiesQuery.data, sourcesQuery.data, tagsQuery.data]);

    return (
        <PageStack>
            <PageCard description={"This workspace now runs in a deterministic single-user mode with shared responsibility removed."} title={"Workspace Mode"}>
                <KeyValueGrid compact>
                    <KeyValuePair label={"Access model"} value={"Single workspace user"} />
                    <KeyValuePair label={"Removed"} value={"Roles, workspace user management, property ownership, watchers, comments"} />
                    <KeyValuePair label={"Available here"} value={"System health, integrations, scheduler controls, portability"} />
                </KeyValueGrid>
            </PageCard>

            <PageCard description={"Live platform health keeps queue pressure and retries visible."} title={"System Health"}>
                {healthQuery.data === undefined ? <p className={"muted-copy"}>{"Loading health metrics..."}</p> : (
                    <KeyValueGrid compact>
                        <KeyValuePair label={"Queue depth"} value={`${healthQuery.data.queue_depth}`} />
                        <KeyValuePair label={"Throughput / hour"} value={healthQuery.data.processing_throughput.toFixed(2)} />
                        <KeyValuePair label={"Retry rate"} value={healthQuery.data.retry_rate.toFixed(2)} />
                        <KeyValuePair label={"Failure sources"} value={healthQuery.data.failure_distribution.map((item) => `${item.label}: ${item.value.toFixed(2)}`).join(", ") || "None"} />
                    </KeyValueGrid>
                )}
            </PageCard>

            <PageCard description={"Slack, email, and webhook integrations now target one configured destination per workspace."} title={"Integrations"}>
                <FormGrid>
                    <Field label={"Kind"}>
                        <Select onChange={(event) => { setIntegrationForm((current) => ({ ...current, kind: event.target.value as typeof current.kind })); }} value={integrationForm.kind}>
                            <option value={"webhook"}>{"webhook"}</option>
                            <option value={"slack"}>{"slack"}</option>
                            <option value={"email"}>{"email"}</option>
                        </Select>
                    </Field>
                    <Field label={"Name"}>
                        <Input onChange={(event) => { setIntegrationForm((current) => ({ ...current, name: event.target.value })); }} value={integrationForm.name} />
                    </Field>
                    <Field label={"Target"}>
                        <Input onChange={(event) => { setIntegrationForm((current) => ({ ...current, target: event.target.value })); }} value={integrationForm.target} />
                    </Field>
                </FormGrid>
                <ActionGroup>
                    <Button disabled={saveIntegrationMutation.isPending} onClick={() => { saveIntegrationMutation.mutate(); }}>
                        {saveIntegrationMutation.isPending ? "Saving..." : "Save integration"}
                    </Button>
                </ActionGroup>
                <DataTable
                    caption={"Integrations"}
                    columns={[
                        { cell: (item) => item.name, header: "Name", id: "name" },
                        { cell: (item) => item.kind, header: "Kind", id: "kind" },
                        { cell: (item) => item.target, header: "Target", id: "target" },
                        { cell: (item) => item.last_test_status ?? "Not tested", header: "Last test", id: "last_test_status" },
                        {
                            align: "right",
                            cell: (item) => item.id !== undefined ? (
                                <Button disabled={testIntegrationMutation.isPending} onClick={() => { if (item.id !== undefined) { testIntegrationMutation.mutate(item.id); } }} size={"small"} variant={"secondary"}>
                                    {"Test"}
                                </Button>
                            ) : "—",
                            header: "Actions",
                            id: "actions",
                        },
                    ]}
                    compact
                    emptyMessage={"No integrations configured."}
                    getRowId={(item) => item.id ?? item.name}
                    items={integrationsQuery.data ?? []}
                    pageSize={5}
                />
                <DataTable
                    caption={"Delivery attempts"}
                    columns={[
                        { cell: (item) => item.trigger_kind, header: "Trigger", id: "trigger_kind" },
                        { cell: (item) => item.status, header: "Status", id: "status" },
                        { cell: (item) => `${item.attempt_count}`, header: "Attempts", id: "attempt_count" },
                        { cell: (item) => item.error_message ?? "—", header: "Error", id: "error_message" },
                        { cell: (item) => formatDateTime(item.created_at), header: "Created", id: "created_at", sortValue: (item) => item.created_at },
                    ]}
                    compact
                    emptyMessage={"No delivery attempts recorded yet."}
                    getRowId={(item) => item.id}
                    items={deliveriesQuery.data ?? []}
                    pageSize={5}
                />
            </PageCard>

            <PageCard description={"Pause automation by property, source, or tag and define maintenance windows that defer work."} title={"Scheduler Controls"}>
                <FormGrid>
                    <Field label={"Pause scope"}>
                        <Select onChange={(event) => { setPauseForm((current) => ({ ...current, scope_type: event.target.value as typeof current.scope_type, scope_value: "" })); }} value={pauseForm.scope_type}>
                            <option value={"property"}>{"property"}</option>
                            <option value={"source"}>{"source"}</option>
                            <option value={"tag"}>{"tag"}</option>
                        </Select>
                    </Field>
                    <Field label={"Scope value"}>
                        <Select onChange={(event) => { setPauseForm((current) => ({ ...current, scope_value: event.target.value })); }} value={pauseForm.scope_value}>
                            <option value={""}>{"Select a target"}</option>
                            {pauseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </Select>
                    </Field>
                    <Field label={"Reason"}>
                        <Input onChange={(event) => { setPauseForm((current) => ({ ...current, reason: event.target.value })); }} value={pauseForm.reason} />
                    </Field>
                </FormGrid>
                <ActionGroup>
                    <Button disabled={createPauseMutation.isPending} onClick={() => { createPauseMutation.mutate(); }}>
                        {createPauseMutation.isPending ? "Saving..." : "Create pause"}
                    </Button>
                </ActionGroup>
                <DataTable
                    caption={"Active scheduler pauses"}
                    columns={[
                        { cell: (item) => item.scope_type, header: "Scope", id: "scope_type" },
                        { cell: (item) => item.scope_value, header: "Target", id: "scope_value" },
                        { cell: (item) => item.reason ?? "—", header: "Reason", id: "reason" },
                        { cell: (item) => item.created_at !== undefined ? formatDateTime(item.created_at) : "—", header: "Created", id: "created_at" },
                        {
                            align: "right",
                            cell: (item) => item.id !== undefined
                                ? <Button onClick={() => { if (item.id !== undefined) { deletePauseMutation.mutate(item.id); } }} size={"small"} variant={"ghost"}>{"Remove"}</Button>
                                : "—",
                            header: "Actions",
                            id: "actions",
                        },
                    ]}
                    compact
                    emptyMessage={"No scheduler pauses configured."}
                    getRowId={(item) => item.id ?? `${item.scope_type}-${item.scope_value}`}
                    items={pausesQuery.data ?? []}
                    pageSize={5}
                />
                <FormGrid>
                    <Field label={"Window name"}>
                        <Input onChange={(event) => { setMaintenanceForm((current) => ({ ...current, name: event.target.value })); }} value={maintenanceForm.name} />
                    </Field>
                    <Field label={"Starts at"}>
                        <Input onChange={(event) => { setMaintenanceForm((current) => ({ ...current, starts_at: event.target.value })); }} type={"datetime-local"} value={maintenanceForm.starts_at} />
                    </Field>
                    <Field label={"Ends at"}>
                        <Input onChange={(event) => { setMaintenanceForm((current) => ({ ...current, ends_at: event.target.value })); }} type={"datetime-local"} value={maintenanceForm.ends_at} />
                    </Field>
                    <Field label={"Reason"}>
                        <Input onChange={(event) => { setMaintenanceForm((current) => ({ ...current, reason: event.target.value })); }} value={maintenanceForm.reason} />
                    </Field>
                </FormGrid>
                <ActionGroup>
                    <Button disabled={createMaintenanceMutation.isPending} onClick={() => { createMaintenanceMutation.mutate(); }}>
                        {createMaintenanceMutation.isPending ? "Saving..." : "Create maintenance window"}
                    </Button>
                </ActionGroup>
                <DataTable
                    caption={"Maintenance windows"}
                    columns={[
                        { cell: (item) => item.name, header: "Name", id: "name" },
                        { cell: (item) => formatDateTime(item.starts_at), header: "Starts", id: "starts_at", sortValue: (item) => item.starts_at },
                        { cell: (item) => formatDateTime(item.ends_at), header: "Ends", id: "ends_at", sortValue: (item) => item.ends_at },
                        { cell: (item) => item.reason ?? "—", header: "Reason", id: "reason" },
                        {
                            align: "right",
                            cell: (item) => item.id !== undefined
                                ? <Button onClick={() => { if (item.id !== undefined) { deleteMaintenanceMutation.mutate(item.id); } }} size={"small"} variant={"ghost"}>{"Remove"}</Button>
                                : "—",
                            header: "Actions",
                            id: "actions",
                        },
                    ]}
                    compact
                    emptyMessage={"No maintenance windows configured."}
                    getRowId={(item) => item.id ?? item.name}
                    items={maintenanceQuery.data ?? []}
                    pageSize={5}
                />
            </PageCard>

            <PageCard description={"Import preview, CSV export, full workspace backup, and restore validation keep the platform portable."} title={"Data Portability"}>
                <Field label={"Property CSV import"}>
                    <Input
                        accept={".csv,text/csv"}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setSelectedImportFile(file);
                        }}
                        type={"file"}
                    />
                </Field>
                <ActionGroup>
                    <Button disabled={selectedImportFile === null || importPreviewMutation.isPending} onClick={() => { importPreviewMutation.mutate(); }} variant={"secondary"}>
                        {importPreviewMutation.isPending ? "Previewing..." : "Preview import"}
                    </Button>
                    <Button disabled={selectedImportFile === null || importCommitMutation.isPending} onClick={() => { importCommitMutation.mutate(); }}>
                        {importCommitMutation.isPending ? "Importing..." : "Commit import"}
                    </Button>
                    <Button disabled={exportPropertiesMutation.isPending} onClick={() => { exportPropertiesMutation.mutate(); }} variant={"secondary"}>
                        {"Export properties CSV"}
                    </Button>
                    <Button disabled={exportWorkspaceMutation.isPending} onClick={() => { exportWorkspaceMutation.mutate(); }} variant={"secondary"}>
                        {"Export workspace backup"}
                    </Button>
                </ActionGroup>
                {(importPreviewMutation.data?.rows.length ?? 0) > 0 ? (
                    <DataTable
                        caption={"Import preview"}
                        columns={[
                            { cell: (item) => `${item.row}`, header: "Row", id: "row" },
                            { cell: (item) => item.label, header: "Label", id: "label" },
                            { cell: (item) => item.url, header: "URL", id: "url" },
                            { cell: (item) => item.valid ? "valid" : item.errors?.join(", ") ?? "invalid", header: "Validation", id: "valid" },
                        ]}
                        compact
                        emptyMessage={"No import preview available."}
                        getRowId={(item) => `${item.row}`}
                        items={importPreviewMutation.data?.rows ?? []}
                        pageSize={5}
                    />
                ) : null}
                <Field label={"Workspace backup restore JSON"}>
                    <Textarea onChange={(event) => { setRestoreJson(event.target.value); }} rows={8} value={restoreJson} />
                </Field>
                <ActionGroup>
                    <Button disabled={restorePreviewMutation.isPending} onClick={() => { restorePreviewMutation.mutate(); }} variant={"secondary"}>
                        {"Validate backup"}
                    </Button>
                    <Button disabled={restoreCommitMutation.isPending} onClick={() => { restoreCommitMutation.mutate(); }}>
                        {"Apply restore"}
                    </Button>
                </ActionGroup>
                {(restorePreviewMutation.data?.rows.length ?? 0) > 0 ? (
                    <DataTable
                        caption={"Restore validation"}
                        columns={[
                            { cell: (item) => `${item.row}`, header: "Row", id: "row" },
                            { cell: (item) => item.label, header: "Label", id: "label" },
                            { cell: (item) => item.url, header: "URL", id: "url" },
                            { cell: (item) => item.valid ? "valid" : item.errors?.join(", ") ?? "invalid", header: "Validation", id: "valid" },
                        ]}
                        compact
                        emptyMessage={"No restore validation results yet."}
                        getRowId={(item) => `${item.row}`}
                        items={restorePreviewMutation.data?.rows ?? []}
                        pageSize={5}
                    />
                ) : null}
            </PageCard>
        </PageStack>
    );
};
