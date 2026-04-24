import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateTime } from "@/lib/format/date";
import { fieldKeys } from "@/services/fields/fields.keys";
import { assignUnmappedField, createField, deleteField, listFields, listUnmappedFields, updateField } from "@/services/fields/fields.service";
import type { FieldDataType, FieldDefinition, FieldDefinitionUsage, UnmappedFieldGroup } from "@/services/fields/fields.types";

interface FieldFormState {
    readonly dataType: FieldDataType;
    readonly description: string;
    readonly displayName: string;
    readonly enumValuesText: string;
    readonly name: string;
    readonly unit: string;
}

const EMPTY_FORM: FieldFormState = {
    dataType: "string",
    description: "",
    displayName: "",
    enumValuesText: "",
    name: "",
    unit: "",
};

const formFromField = (field: FieldDefinitionUsage | null): FieldFormState => ({
    dataType: field?.data_type ?? "string",
    description: field?.description ?? "",
    displayName: field?.display_name ?? "",
    enumValuesText: (field?.enum_values ?? []).join("\n"),
    name: field?.name ?? "",
    unit: field?.unit ?? "",
});

const parseEnumValues = (value: string): string[] | undefined => {
    const items = value.split("\n").map((item) => item.trim()).filter((item) => item !== "");
    return items.length > 0 ? items : undefined;
};

export const FieldsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [search, setSearch] = useState("");
    const [scope, setScope] = useState<"all" | "system" | "user">("all");
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldDefinitionUsage | null>(null);
    const [form, setForm] = useState<FieldFormState>(EMPTY_FORM);
    const [deleteTarget, setDeleteTarget] = useState<FieldDefinitionUsage | null>(null);
    const [assignTarget, setAssignTarget] = useState<UnmappedFieldGroup | null>(null);
    const [assignFieldName, setAssignFieldName] = useState("");

    const fieldsQuery = useQuery({
        queryFn: listFields,
        queryKey: fieldKeys.list(),
    });
    const unmappedQuery = useQuery({
        queryFn: listUnmappedFields,
        queryKey: fieldKeys.unmapped(),
    });

    const invalidateAll = (): void => {
        void queryClient.invalidateQueries({ queryKey: fieldKeys.list() });
        void queryClient.invalidateQueries({ queryKey: fieldKeys.unmapped() });
    };

    const createMutation = useMutation({
        mutationFn: createField,
        onError() {
            pushToast("Could not create field.", "error");
        },
        onSuccess() {
            invalidateAll();
            setEditorOpen(false);
            setForm(EMPTY_FORM);
            pushToast("Field created.", "success");
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({ fieldId, request }: { fieldId: string; request: Partial<FieldDefinition>; }) => updateField(fieldId, request),
        onError() {
            pushToast("Could not update field.", "error");
        },
        onSuccess() {
            invalidateAll();
            setEditorOpen(false);
            setEditingField(null);
            setForm(EMPTY_FORM);
            pushToast("Field updated.", "success");
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteField,
        onError() {
            pushToast("Could not delete field.", "error");
        },
        onSuccess() {
            invalidateAll();
            setDeleteTarget(null);
            pushToast("Field deleted.", "success");
        },
    });
    const assignMutation = useMutation({
        mutationFn: assignUnmappedField,
        onError() {
            pushToast("Could not assign the unmapped selector.", "error");
        },
        onSuccess() {
            invalidateAll();
            setAssignTarget(null);
            setAssignFieldName("");
            pushToast("Unmapped values linked to the selected field.", "success");
        },
    });

    const filteredFields = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return (fieldsQuery.data ?? []).filter((field) => {
            if (scope === "system" && !field.system_defined) {
                return false;
            }

            if (scope === "user" && field.system_defined) {
                return false;
            }

            if (normalizedSearch === "") {
                return true;
            }

            return [field.name, field.display_name, field.description ?? "", field.unit ?? ""]
                .some((value) => value.toLowerCase().includes(normalizedSearch));
        });
    }, [fieldsQuery.data, scope, search]);

    const systemFields = useMemo(() => (fieldsQuery.data ?? []).filter((field) => field.system_defined), [fieldsQuery.data]);
    const customFields = useMemo(() => (fieldsQuery.data ?? []).filter((field) => !field.system_defined), [fieldsQuery.data]);

    const openCreate = (): void => {
        setEditingField(null);
        setForm(EMPTY_FORM);
        setEditorOpen(true);
    };

    const openEdit = (field: FieldDefinitionUsage): void => {
        setEditingField(field);
        setForm(formFromField(field));
        setEditorOpen(true);
    };

    const submitField = (): void => {
        const request = {
            data_type: form.dataType,
            description: form.description.trim() !== "" ? form.description.trim() : undefined,
            display_name: form.displayName.trim(),
            enum_values: form.dataType === "enum" ? parseEnumValues(form.enumValuesText) : undefined,
            name: form.name.trim(),
            unit: form.unit.trim() !== "" ? form.unit.trim() : undefined,
        };

        if (editingField === null) {
            createMutation.mutate(request);
            return;
        }

        updateMutation.mutate({ fieldId: editingField.id, request });
    };

    return (
        <>
            <PageStack>
                <PageCard
                    action={(
                        <Button iconBefore={<Icon name={"plus"} />} onClick={openCreate}>
                            {"Create field"}
                        </Button>
                    )}
                    description={"Define shared canonical fields, map legacy outputs, and keep cross-property data analytics-ready."}
                    title={"Fields"}
                >
                    <div className={"selector-builder__identity-grid"}>
                        <Field label={"Search fields"}>
                            <Input onChange={(event) => { setSearch(event.target.value); }} placeholder={"Search by name or metadata"} value={search} />
                        </Field>
                        <Field label={"Scope"}>
                            <Select onChange={(event) => { setScope(event.target.value as "all" | "system" | "user"); }} value={scope}>
                                <option value={"all"}>{"All fields"}</option>
                                <option value={"system"}>{"System fields"}</option>
                                <option value={"user"}>{"User-defined fields"}</option>
                            </Select>
                        </Field>
                    </div>
                </PageCard>

                <Tabs
                    defaultTabId={"definitions"}
                    items={[
                        {
                            id: "definitions",
                            label: "Definitions",
                            panel: (
                                <>
                                    {fieldsQuery.isError ? <ErrorBanner>{"Could not load fields."}</ErrorBanner> : null}
                                    <DataTable
                                        caption={"Field definitions"}
                                        columns={[
                                            {
                                                cell: (item) => (
                                                    <div>
                                                        <strong>{item.display_name}</strong>
                                                        <div className={"muted-copy"}>{item.name}</div>
                                                    </div>
                                                ),
                                                header: "Field",
                                                id: "field",
                                                sortValue: (item) => item.display_name,
                                            },
                                            {
                                                cell: (item) => <StatusBadge tone={item.system_defined ? "neutral" : "success"} value={item.system_defined ? "system" : "custom"} />,
                                                header: "Kind",
                                                id: "kind",
                                            },
                                            {
                                                cell: (item) => item.data_type,
                                                header: "Type",
                                                id: "type",
                                                sortValue: (item) => item.data_type,
                                                width: "8rem",
                                            },
                                            {
                                                cell: (item) => item.unit ?? "—",
                                                header: "Unit",
                                                id: "unit",
                                                width: "8rem",
                                            },
                                            {
                                                cell: (item) => `${item.properties_using} properties · ${item.value_count} values`,
                                                header: "Usage",
                                                id: "usage",
                                                sortValue: (item) => item.properties_using,
                                                width: "14rem",
                                            },
                                            {
                                                cell: (item) => item.description ?? "—",
                                                header: "Description",
                                                id: "description",
                                                wrap: true,
                                            },
                                            {
                                                align: "right",
                                                cell: (item) => (
                                                    <div className={"action-group"}>
                                                        <Button onClick={() => { openEdit(item); }} size={"small"} variant={"secondary"}>{"Edit"}</Button>
                                                        <Button onClick={() => { setDeleteTarget(item); }} size={"small"} variant={"secondary"}>{"Delete"}</Button>
                                                    </div>
                                                ),
                                                header: "Actions",
                                                id: "actions",
                                                width: "12rem",
                                            },
                                        ]}
                                        emptyMessage={"No fields found."}
                                        getRowId={(item) => item.id}
                                        items={filteredFields}
                                        pageSize={15}
                                    />
                                </>
                            ),
                        },
                        {
                            id: "unmapped",
                            label: "Unmapped values",
                            panel: (
                                <>
                                    {unmappedQuery.isError ? <ErrorBanner>{"Could not load unmapped values."}</ErrorBanner> : null}
                                    <DataTable
                                        caption={"Unmapped field groups"}
                                        columns={[
                                            {
                                                cell: (item) => item.property_label ?? item.property_id,
                                                header: "Property",
                                                id: "property",
                                                sortValue: (item) => item.property_label ?? item.property_id,
                                            },
                                            {
                                                cell: (item) => item.selector_name,
                                                header: "Output",
                                                id: "selector",
                                                sortValue: (item) => item.selector_name,
                                            },
                                            {
                                                cell: (item) => item.sample_value ?? "—",
                                                header: "Sample value",
                                                id: "sample",
                                                wrap: true,
                                            },
                                            {
                                                cell: (item) => item.value_count.toLocaleString("en"),
                                                header: "Values",
                                                id: "count",
                                                sortValue: (item) => item.value_count,
                                                width: "7rem",
                                            },
                                            {
                                                cell: (item) => formatDateTime(item.observed_at),
                                                header: "Latest",
                                                id: "observed",
                                                sortValue: (item) => item.observed_at,
                                                width: "12rem",
                                            },
                                            {
                                                align: "right",
                                                cell: (item) => <Button onClick={() => { setAssignTarget(item); }} size={"small"} variant={"secondary"}>{"Assign field"}</Button>,
                                                header: "Actions",
                                                id: "actions",
                                                width: "10rem",
                                            },
                                        ]}
                                        emptyMessage={"No unmapped values found."}
                                        getRowId={(item) => `${item.property_id}:${item.selector_name}`}
                                        items={unmappedQuery.data ?? []}
                                        pageSize={15}
                                    />
                                </>
                            ),
                        },
                    ]}
                />
            </PageStack>

            <Dialog
                actions={(
                    <>
                        <Button onClick={() => { setEditorOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button
                            disabled={form.name.trim() === "" || form.displayName.trim() === "" || (form.dataType === "enum" && parseEnumValues(form.enumValuesText) === undefined)}
                            isLoading={createMutation.isPending || updateMutation.isPending}
                            onClick={submitField}
                        >
                            {editingField === null ? "Create field" : "Save field"}
                        </Button>
                    </>
                )}
                onOpenChange={setEditorOpen}
                open={editorOpen}
                title={editingField === null ? "Create field" : `Edit ${editingField.display_name}`}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <Field label={"Field name"}>
                        <Input
                            disabled={editingField !== null}
                            onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); }}
                            placeholder={"price"}
                            value={form.name}
                        />
                    </Field>
                    <Field label={"Display name"}>
                        <Input onChange={(event) => { setForm((current) => ({ ...current, displayName: event.target.value })); }} value={form.displayName} />
                    </Field>
                    <Field label={"Data type"}>
                        <Select onChange={(event) => { setForm((current) => ({ ...current, dataType: event.target.value as FieldDataType })); }} value={form.dataType}>
                            <option value={"string"}>{"string"}</option>
                            <option value={"number"}>{"number"}</option>
                            <option value={"boolean"}>{"boolean"}</option>
                            <option value={"enum"}>{"enum"}</option>
                        </Select>
                    </Field>
                    {form.dataType === "enum" ? (
                        <Field hint={"One allowed value per line."} label={"Enum values"}>
                            <Textarea onChange={(event) => { setForm((current) => ({ ...current, enumValuesText: event.target.value })); }} rows={4} value={form.enumValuesText} />
                        </Field>
                    ) : null}
                    <Field label={"Unit"}>
                        <Input onChange={(event) => { setForm((current) => ({ ...current, unit: event.target.value })); }} placeholder={"€, m²"} value={form.unit} />
                    </Field>
                    <Field label={"Description"}>
                        <Textarea onChange={(event) => { setForm((current) => ({ ...current, description: event.target.value })); }} rows={3} value={form.description} />
                    </Field>
                </div>
            </Dialog>

            <ConfirmDialog
                confirmLabel={"Delete field"}
                description={deleteTarget === null ? "" : `Delete "${deleteTarget.display_name}"? Fields can only be removed when they are no longer in use.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    if (deleteTarget !== null) {
                        deleteMutation.mutate(deleteTarget.id);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
                open={deleteTarget !== null}
                title={"Delete field"}
            />

            <Dialog
                actions={(
                    <>
                        <Button onClick={() => { setAssignTarget(null); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button
                            disabled={assignTarget === null || assignFieldName.trim() === ""}
                            isLoading={assignMutation.isPending}
                            onClick={() => {
                                if (assignTarget !== null) {
                                    assignMutation.mutate({
                                        field_name: assignFieldName,
                                        property_id: assignTarget.property_id,
                                        selector_name: assignTarget.selector_name,
                                    });
                                }
                            }}
                        >
                            {"Assign field"}
                        </Button>
                    </>
                )}
                onOpenChange={(open) => {
                    if (!open) {
                        setAssignTarget(null);
                    }
                }}
                open={assignTarget !== null}
                title={"Assign unmapped output"}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <p className={"muted-copy"}>
                        {assignTarget === null ? "" : `Link "${assignTarget.selector_name}" on ${assignTarget.property_label ?? assignTarget.property_id} to a canonical field and backfill historical values.`}
                    </p>
                    <Field label={"Canonical field"}>
                        <Select onChange={(event) => { setAssignFieldName(event.target.value); }} value={assignFieldName}>
                            <option value={""}>{"Select a field"}</option>
                            {systemFields.length > 0 ? (
                                <optgroup label={"System fields"}>
                                    {systemFields.map((field) => <option key={field.id} value={field.name}>{field.display_name}</option>)}
                                </optgroup>
                            ) : null}
                            {customFields.length > 0 ? (
                                <optgroup label={"Custom fields"}>
                                    {customFields.map((field) => <option key={field.id} value={field.name}>{field.display_name}</option>)}
                                </optgroup>
                            ) : null}
                        </Select>
                    </Field>
                </div>
            </Dialog>
        </>
    );
};
