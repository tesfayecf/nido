import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { fieldKeys } from "@/services/fields/fields.keys";
import { listFields } from "@/services/fields/fields.service";
import {
    DEFAULT_WORKSPACE_SETTINGS,
    FIELD_MAPPING_GROUPS,
    readWorkspaceSettings,
    saveWorkspaceSettings,
    type WorkspaceFieldMappings,
    type WorkspaceSettings,
} from "@/features/settings/workspaceSettings";

const IGNORED_FIELD_CANDIDATES_KEY = "nido.field-candidates.ignored";
const MAPPED_FIELD_CANDIDATES_KEY = "nido.field-candidates.mapped";

type FieldCandidateStatus = "active" | "ignored" | "mapped";

interface FieldCandidateRow {
    readonly field: string;
    readonly groups: string[];
    readonly mappedTo?: string;
    readonly status: FieldCandidateStatus;
}

const readJsonRecord = <TValue,>(key: string, fallback: TValue): TValue => {
    try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw) as TValue;
    } catch {
        return fallback;
    }
};

const collectCandidates = (settings: WorkspaceSettings, ignoredFields: readonly string[], mappedFields: Readonly<Record<string, string>>): FieldCandidateRow[] => {
    const ignored = new Set(ignoredFields);
    const allNames = new Set<string>();
    const groupsByName = new Map<string, string[]>();

    for (const sourceSettings of [DEFAULT_WORKSPACE_SETTINGS, settings]) {
        for (const group of FIELD_MAPPING_GROUPS) {
            for (const fieldName of sourceSettings.field_mappings[group.key]) {
                allNames.add(fieldName);
                groupsByName.set(fieldName, [...groupsByName.get(fieldName) ?? [], group.label]);
            }
        }
    }

    return [...allNames].sort((left, right) => left.localeCompare(right)).map((field) => {
        const mappedTo = mappedFields[field];
        return {
            field,
            groups: [...new Set(groupsByName.get(field) ?? [])],
            mappedTo,
            status: mappedTo !== undefined ? "mapped" : ignored.has(field) ? "ignored" : "active",
        };
    });
};

const updateFieldMappings = (settings: WorkspaceSettings, sourceField: string, targetField: string | null): WorkspaceSettings => ({
    ...settings,
    field_mappings: Object.fromEntries(
        FIELD_MAPPING_GROUPS.map((group) => {
            const currentValues = settings.field_mappings[group.key];
            const shouldAddMappedField = targetField !== null
                && currentValues.includes(sourceField)
                && !currentValues.includes(targetField);
            const nextValues = currentValues
                .filter((field) => field !== sourceField)
                .concat(shouldAddMappedField ? [targetField] : []);

            return [group.key, nextValues];
        }),
    ) as unknown as WorkspaceFieldMappings,
});

export const FieldCandidatesPage = (): JSX.Element => {
    const { pushToast } = useToast();
    const fieldsQuery = useQuery({
        queryFn: listFields,
        queryKey: fieldKeys.list(),
    });
    const [settings, setSettings] = useState<WorkspaceSettings>(() => readWorkspaceSettings());
    const [ignoredFields, setIgnoredFields] = useState<string[]>(() => readJsonRecord<string[]>(IGNORED_FIELD_CANDIDATES_KEY, []));
    const [mappedFields, setMappedFields] = useState<Record<string, string>>(() => readJsonRecord<Record<string, string>>(MAPPED_FIELD_CANDIDATES_KEY, {}));
    const [pendingMappings, setPendingMappings] = useState<Record<string, string>>({});
    const candidates = useMemo(() => collectCandidates(settings, ignoredFields, mappedFields), [ignoredFields, mappedFields, settings]);
    const fieldOptions = fieldsQuery.data ?? [];

    const saveIgnored = (values: string[]): void => {
        setIgnoredFields(values);
        window.localStorage.setItem(IGNORED_FIELD_CANDIDATES_KEY, JSON.stringify(values));
    };

    const saveMapped = (values: Record<string, string>): void => {
        setMappedFields(values);
        window.localStorage.setItem(MAPPED_FIELD_CANDIDATES_KEY, JSON.stringify(values));
    };

    const persistSettings = (nextSettings: WorkspaceSettings): void => {
        setSettings(nextSettings);
        saveWorkspaceSettings(nextSettings);
    };

    const approveCandidate = (field: string): void => {
        saveIgnored(ignoredFields.filter((item) => item !== field));
        pushToast(`${field} is active.`, "success");
    };

    const ignoreCandidate = (field: string): void => {
        saveIgnored([...new Set([...ignoredFields, field])]);
        persistSettings(updateFieldMappings(settings, field, null));
        pushToast(`${field} ignored.`, "success");
    };

    const mapCandidate = (field: string): void => {
        const target = pendingMappings[field];
        if (target === undefined || target === "") {
            return;
        }

        const nextMapped = { ...mappedFields, [field]: target };
        saveMapped(nextMapped);
        saveIgnored(ignoredFields.filter((item) => item !== field));
        persistSettings(updateFieldMappings(settings, field, target));
        pushToast(`${field} mapped to ${target}.`, "success");
    };

    const approveAll = (): void => {
        saveIgnored([]);
        pushToast("All field candidates approved.", "success");
    };

    return (
        <PageStack>
            <PageCard
                action={<Button as={Link} to={"/settings"} variant={"secondary"}>{"Back to Settings"}</Button>}
                description={"Review suggested extraction fields separately from operational pause and retry controls."}
                title={"Field Candidates"}
            >
                <KeyValueGrid compact>
                    <KeyValuePair label={"Suggested fields"} value={`${candidates.filter((candidate) => candidate.status === "active").length}`} />
                    <KeyValuePair label={"Accepted fields"} value={`${candidates.filter((candidate) => candidate.status === "mapped").length}`} />
                    <KeyValuePair label={"Ignored fields"} value={`${candidates.filter((candidate) => candidate.status === "ignored").length}`} />
                </KeyValueGrid>
                <ActionGroup>
                    <Button onClick={approveAll} variant={"secondary"}>{"Approve all visible candidates"}</Button>
                </ActionGroup>
            </PageCard>
            <PageCard description={"Each visible control approves, ignores, or maps a candidate to an existing canonical field."} title={"Candidate review"}>
                <DataTable
                    caption={"Field candidates"}
                    columns={[
                        { cell: (item) => item.field, header: "Candidate field", id: "field", sortValue: (item) => item.field },
                        { cell: (item) => item.groups.join(", ") || "Suggested", header: "Suggested fields", id: "groups", sortValue: (item) => item.groups.join(", ") },
                        { cell: (item) => <StatusBadge tone={item.status === "active" ? "success" : item.status === "mapped" ? "neutral" : "warning"} value={item.status} />, header: "Status", id: "status", sortValue: (item) => item.status },
                        { cell: (item) => item.mappedTo ?? "Not mapped", header: "Accepted field", id: "mappedTo", sortValue: (item) => item.mappedTo ?? "" },
                        {
                            cell: (item) => (
                                <ActionGroup>
                                    <Button disabled={item.status === "active"} onClick={() => { approveCandidate(item.field); }} size={"small"} variant={"secondary"}>{"Approve"}</Button>
                                    <Button disabled={item.status === "ignored"} onClick={() => { ignoreCandidate(item.field); }} size={"small"} variant={"secondary"}>{"Ignore"}</Button>
                                    <Field label={"Map to existing field"}>
                                        <Select onChange={(event) => { setPendingMappings((current) => ({ ...current, [item.field]: event.target.value })); }} value={pendingMappings[item.field] ?? ""}>
                                            <option value={""}>{"Map to existing field"}</option>
                                            {fieldOptions.map((field) => <option key={field.id} value={field.name}>{field.display_name}</option>)}
                                        </Select>
                                    </Field>
                                    <Button disabled={(pendingMappings[item.field] ?? "") === ""} onClick={() => { mapCandidate(item.field); }} size={"small"}>{"Map"}</Button>
                                </ActionGroup>
                            ),
                            header: "Actions",
                            id: "actions",
                            wrap: true,
                        },
                    ]}
                    emptyMessage={"No candidate fields are available."}
                    getRowId={(item) => item.field}
                    items={candidates}
                    pageSize={12}
                />
            </PageCard>
        </PageStack>
    );
};
