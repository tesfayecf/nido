import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { QueryDataTable } from "@/components/ui/QueryDataTable";
import { Select } from "@/components/ui/Select";
import { SecondarySurfaceHeader } from "@/components/ui/SecondarySurfaceHeader";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { fieldKeys } from "@/services/fields/fields.keys";
import { createField, deleteField, listFields, updateField } from "@/services/fields/fields.service";
import type { FieldDataType, FieldDefinition, FieldDefinitionUsage } from "@/services/fields/fields.types";

interface FieldFormState {
    readonly dataType: FieldDataType;
    readonly description: string;
    readonly displayName: string;
    readonly enumValuesText: string;
    readonly name: string;
    readonly unit: string;
    readonly defaultValue: string;
    readonly useDefaultWhenMissing: boolean;
    readonly comparisonOperator: "" | "eq" | "gt" | "lt" | "contains";
    readonly comparisonValue: string;
}

const EMPTY_FORM: FieldFormState = {
    dataType: "string",
    description: "",
    displayName: "",
    enumValuesText: "",
    name: "",
    unit: "",
    defaultValue: "",
    useDefaultWhenMissing: false,
    comparisonOperator: "",
    comparisonValue: "",
};

const formFromField = (field: FieldDefinitionUsage | null): FieldFormState => ({
    dataType: field?.data_type ?? "string",
    description: field?.description ?? "",
    displayName: field?.display_name ?? "",
    enumValuesText: (field?.enum_values ?? []).join("\n"),
    name: field?.name ?? "",
    unit: field?.unit ?? "",
    defaultValue: field?.default_value ?? "",
    useDefaultWhenMissing: field?.use_default_when_missing ?? false,
    comparisonOperator: field?.comparison_operator ?? "",
    comparisonValue: field?.comparison_value ?? "",
});

const parseEnumValues = (value: string): string[] | undefined => {
    const items = value.split("\n").map((item) => item.trim()).filter((item) => item !== "");
    return items.length > 0 ? items : undefined;
};

export const FieldsPage = (): JSX.Element => {
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const [search, setSearch] = useState("");
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldDefinitionUsage | null>(null);
    const [form, setForm] = useState<FieldFormState>(EMPTY_FORM);
    const [deleteTarget, setDeleteTarget] = useState<FieldDefinitionUsage | null>(null);

    const fieldsQuery = useQuery({
        queryFn: listFields,
        queryKey: fieldKeys.list(),
    });

    const invalidateAll = (): void => {
        void queryClient.invalidateQueries({ queryKey: fieldKeys.list() });
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

    const filteredFields = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return (fieldsQuery.data ?? []).filter((field) => {
            if (normalizedSearch === "") {
                return true;
            }

            return [field.name, field.display_name, field.description ?? "", field.unit ?? ""]
                .some((value) => value.toLowerCase().includes(normalizedSearch));
        });
    }, [fieldsQuery.data, search]);

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
            default_value: form.defaultValue.trim() !== "" ? form.defaultValue.trim() : undefined,
            use_default_when_missing: form.useDefaultWhenMissing,
            comparison_operator: form.dataType === "boolean" && form.comparisonOperator !== "" ? form.comparisonOperator : undefined,
            comparison_value: form.dataType === "boolean" && form.comparisonValue.trim() !== "" ? form.comparisonValue.trim() : undefined,
        };

        if (editingField === null) {
            createMutation.mutate(request);
            return;
        }

        updateMutation.mutate({ fieldId: editingField.id, request });
    };

    const fields = fieldsQuery.data ?? [];
    const fieldsInUse = fields.filter((field) => field.properties_using > 0).length;
    const enumFields = fields.filter((field) => field.data_type === "enum").length;

    return (
        <>
            <PageStack>
                <SecondarySurfaceHeader
                    action={(
                        <Button iconBefore={<Icon name={"plus"} />} onClick={openCreate}>
                            {"Create field"}
                        </Button>
                    )}
                    description={"Define shared canonical fields and keep cross-property data analytics-ready."}
                    summaryAriaLabel={"Fields overview"}
                    summaryItems={[
                        {
                            context: fieldsQuery.isLoading ? "Loading field definitions." : `${filteredFields.length} matching the current search.`,
                            label: "Definitions",
                            value: fieldsQuery.isLoading ? "—" : `${fields.length}`,
                        },
                        {
                            context: fieldsQuery.isLoading ? "Loading usage coverage." : fieldsInUse === 0 ? "No fields are in active use yet." : "These fields already appear across properties.",
                            label: "In use",
                            value: fieldsQuery.isLoading ? "—" : `${fieldsInUse}`,
                        },
                        {
                            context: fieldsQuery.isLoading ? "Loading enum fields." : enumFields === 0 ? "No enum definitions configured." : "Enum fields constrain values to explicit options.",
                            label: "Enum fields",
                            value: fieldsQuery.isLoading ? "—" : `${enumFields}`,
                        },
                    ]}
                    title={"Fields"}
                >
                    <div className={"selector-builder__identity-grid"}>
                        <Field label={"Search fields"}>
                            <Input onChange={(event) => { setSearch(event.target.value); }} placeholder={"Search by name or metadata"} value={search} />
                        </Field>
                        <div className={"muted-copy"} style={{ alignSelf: "end" }}>{"All fields are managed in one shared list."}</div>
                    </div>
                </SecondarySurfaceHeader>
                <PageCard description={"Manage the canonical fields used across extracted property data."} title={"Field definitions"}>
                    <QueryDataTable
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
                                        <Link aria-label={`Analyze ${item.display_name}`} className={"icon-button"} title={"Analyze"} to={`/fields/${encodeURIComponent(item.name)}/analytics`}>
                                            <Icon name={"history"} />
                                        </Link>
                                        <button aria-label={`Edit ${item.display_name}`} className={"icon-button"} onClick={() => { openEdit(item); }} title={"Edit"} type={"button"}>
                                            <Icon name={"edit"} />
                                        </button>
                                        <button aria-label={`Delete ${item.display_name}`} className={"icon-button icon-button--danger"} onClick={() => { setDeleteTarget(item); }} title={"Delete"} type={"button"}>
                                            <Icon name={"trash"} />
                                        </button>
                                    </div>
                                ),
                                header: "Actions",
                                id: "actions",
                                width: "12rem",
                            },
                        ]}
                        emptyMessage={"No fields found."}
                        errorMessage={"Could not load fields."}
                        getRowId={(item) => item.id}
                        isError={fieldsQuery.isError}
                        isLoading={fieldsQuery.isLoading}
                        items={filteredFields}
                        loadingMessage={"Loading fields..."}
                        pageSize={15}
                        rowLabel={(item) => `Field ${item.display_name}`}
                    />
                </PageCard>
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
                    <Field label={"Use default if missing"} variant={"checkbox"}>
                        <input checked={form.useDefaultWhenMissing} onChange={(event) => { setForm((current) => ({ ...current, useDefaultWhenMissing: event.target.checked })); }} type={"checkbox"} />
                    </Field>
                    {form.useDefaultWhenMissing ? (
                        <Field hint={"Returned when the field is missing or empty."} label={"Default value"}>
                            <Input onChange={(event) => { setForm((current) => ({ ...current, defaultValue: event.target.value })); }} value={form.defaultValue} />
                        </Field>
                    ) : null}
                    {form.dataType === "boolean" ? (
                        <>
                            <Field label={"Comparison rule"}>
                                <Select onChange={(event) => { setForm((current) => ({ ...current, comparisonOperator: event.target.value as FieldFormState["comparisonOperator"] })); }} value={form.comparisonOperator}>
                                    <option value={""}>{"None"}</option>
                                    <option value={"eq"}>{"Equals"}</option>
                                    <option value={"gt"}>{"Greater than"}</option>
                                    <option value={"lt"}>{"Less than"}</option>
                                    <option value={"contains"}>{"Contains"}</option>
                                </Select>
                            </Field>
                            {form.comparisonOperator !== "" ? (
                                <Field label={"Comparison value"}>
                                    <Input onChange={(event) => { setForm((current) => ({ ...current, comparisonValue: event.target.value })); }} value={form.comparisonValue} />
                                </Field>
                            ) : null}
                        </>
                    ) : null}
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
        </>
    );
};
