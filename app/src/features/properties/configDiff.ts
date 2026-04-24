import type { FieldSelector, PropertyExtractionConfig } from "@/services/properties/properties.types";

interface ConfigFieldChange {
    readonly field: string;
    readonly next?: FieldSelector;
    readonly previous?: FieldSelector;
    readonly type: "added" | "modified" | "removed";
}

export interface ConfigDiffSummary {
    readonly changedCount: number;
    readonly changes: ConfigFieldChange[];
}

const serializeField = (field: FieldSelector): string => {
    return JSON.stringify(field);
};

export const diffPropertyConfigs = (
    previous: PropertyExtractionConfig | undefined,
    next: PropertyExtractionConfig | undefined,
): ConfigDiffSummary => {
    const previousByName = new Map((previous?.fields ?? []).map((field) => [field.name, field]));
    const nextByName = new Map((next?.fields ?? []).map((field) => [field.name, field]));
    const names = new Set<string>([...previousByName.keys(), ...nextByName.keys()]);
    const changes: ConfigFieldChange[] = [];

    [...names]
        .sort((left, right) => left.localeCompare(right))
        .forEach((name) => {
            const previousField = previousByName.get(name);
            const nextField = nextByName.get(name);
            if (previousField === undefined && nextField !== undefined) {
                changes.push({ field: name, next: nextField, type: "added" });
                return;
            }

            if (previousField !== undefined && nextField === undefined) {
                changes.push({ field: name, previous: previousField, type: "removed" });
                return;
            }

            if (previousField !== undefined && nextField !== undefined && serializeField(previousField) !== serializeField(nextField)) {
                changes.push({ field: name, next: nextField, previous: previousField, type: "modified" });
            }
        });

    return {
        changedCount: changes.length,
        changes,
    };
};
