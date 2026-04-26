import type {
    ExtractionMode,
    FieldSelector,
    PropertyPreviewFieldResult,
    SelectorType,
    TextMode,
} from "@/services/properties/properties.types";

export interface SelectorFieldDraft {
    readonly attribute: string;
    readonly extractionMode: ExtractionMode;
    readonly fieldName: string;
    readonly fallbackSelectorsRaw: string;
    readonly id: string;
    readonly name: string;
    readonly required: boolean;
    readonly selectorType: SelectorType;
    readonly selectorValue: string;
    readonly textMode: TextMode;
    readonly transform: string;
    readonly defaultValue: string;
    readonly useDefaultWhenMissing: boolean;
    readonly regexPattern: string;
    readonly splitDelimiter: string;
    readonly multiValue: boolean;
    readonly partialMatch: string;
    readonly comparisonOperator: "" | "eq" | "gt" | "lt" | "contains";
    readonly comparisonValue: string;
}

interface LegacyFieldSelector {
    readonly attribute?: string;
    readonly extraction_mode?: ExtractionMode;
    readonly field_name?: string;
    readonly fallback_selectors?: string[];
    readonly name?: string;
    readonly required?: boolean;
    readonly selector_type?: SelectorType;
    readonly selector_value?: string;
    readonly selectors?: string[];
    readonly text_mode?: TextMode;
    readonly transform?: string;
    readonly default_value?: string;
    readonly use_default_when_missing?: boolean;
    readonly regex_pattern?: string;
    readonly split_delimiter?: string;
    readonly multi_value?: boolean;
    readonly partial_match?: string;
    readonly comparison_operator?: "" | "eq" | "gt" | "lt" | "contains";
    readonly comparison_value?: string;
}

const DEFAULT_TEXT_MODE: TextMode = "innerText";

const normalizeSelectorType = (selectorType?: string, extractionMode?: ExtractionMode): SelectorType => {
    if (selectorType === "xpath") {
        return "xpath";
    }

    if (selectorType === "attribute") {
        return "attribute";
    }

    if (selectorType === "text") {
        return "text";
    }

    if (extractionMode === "attribute") {
        return "attribute";
    }

    return "css";
};

const normalizeExtractionMode = (selectorType?: string, extractionMode?: ExtractionMode, attribute?: string): ExtractionMode => {
    if (selectorType === "attribute") {
        return "attribute";
    }

    if (selectorType === "text") {
        return "text";
    }

    if (extractionMode === "attribute" || (attribute ?? "").trim() !== "") {
        return "attribute";
    }

    return "text";
};

export const normalizeFieldSelector = (raw: LegacyFieldSelector): FieldSelector => {
    const selectors = raw.selectors?.map((selector) => selector.trim()).filter((selector) => selector !== "") ?? [];
    const selectorValue = (raw.selector_value ?? selectors[0] ?? "").trim();
    const extractionMode = normalizeExtractionMode(raw.selector_type, raw.extraction_mode, raw.attribute);

    return {
        attribute: raw.attribute?.trim() !== "" ? raw.attribute?.trim() : undefined,
        extraction_mode: extractionMode,
        field_name: raw.field_name?.trim() !== "" ? raw.field_name?.trim() : undefined,
        fallback_selectors: raw.fallback_selectors?.map((selector) => selector.trim()).filter((selector) => selector !== "")
            ?? selectors.slice(1),
        name: (raw.name ?? "").trim(),
        required: raw.required ?? false,
        selector_type: normalizeSelectorType(raw.selector_type, extractionMode),
        selector_value: selectorValue,
        text_mode: raw.text_mode ?? DEFAULT_TEXT_MODE,
        transform: raw.transform?.trim() !== "" ? raw.transform?.trim() : undefined,
        default_value: raw.default_value?.trim() !== "" ? raw.default_value?.trim() : undefined,
        use_default_when_missing: raw.use_default_when_missing ?? false,
        regex_pattern: raw.regex_pattern?.trim() !== "" ? raw.regex_pattern?.trim() : undefined,
        split_delimiter: raw.split_delimiter?.trim() !== "" ? raw.split_delimiter?.trim() : undefined,
        multi_value: raw.multi_value ?? false,
        partial_match: raw.partial_match?.trim() !== "" ? raw.partial_match?.trim() : undefined,
        comparison_operator: raw.comparison_operator?.trim() !== "" ? raw.comparison_operator : undefined,
        comparison_value: raw.comparison_value?.trim() !== "" ? raw.comparison_value?.trim() : undefined,
    };
};

export const createEmptySelectorDraft = (): SelectorFieldDraft => ({
    attribute: "",
    extractionMode: "text",
    fieldName: "",
    fallbackSelectorsRaw: "",
    id: crypto.randomUUID(),
    name: "",
    required: false,
    selectorType: "css",
    selectorValue: "",
    textMode: DEFAULT_TEXT_MODE,
    transform: "",
    defaultValue: "",
    useDefaultWhenMissing: false,
    regexPattern: "",
    splitDelimiter: "",
    multiValue: false,
    partialMatch: "",
    comparisonOperator: "",
    comparisonValue: "",
});

export const createDefaultSelectorDrafts = (): SelectorFieldDraft[] => [
    { ...createEmptySelectorDraft(), fieldName: "price", name: "price", required: true },
    { ...createEmptySelectorDraft(), fieldName: "title", name: "title" },
    { ...createEmptySelectorDraft(), fieldName: "location", name: "location" },
];

export const selectorToDraft = (selector: FieldSelector): SelectorFieldDraft => ({
    attribute: selector.attribute ?? "",
    extractionMode: selector.extraction_mode,
    fieldName: selector.field_name ?? "",
    fallbackSelectorsRaw: (selector.fallback_selectors ?? []).join("\n"),
    id: crypto.randomUUID(),
    name: selector.name,
    required: selector.required,
    selectorType: selector.selector_type,
    selectorValue: selector.selector_value,
    textMode: selector.text_mode ?? DEFAULT_TEXT_MODE,
    transform: selector.transform ?? "",
    defaultValue: selector.default_value ?? "",
    useDefaultWhenMissing: selector.use_default_when_missing ?? false,
    regexPattern: selector.regex_pattern ?? "",
    splitDelimiter: selector.split_delimiter ?? "",
    multiValue: selector.multi_value ?? false,
    partialMatch: selector.partial_match ?? "",
    comparisonOperator: selector.comparison_operator ?? "",
    comparisonValue: selector.comparison_value ?? "",
});

export const draftToSelector = (draft: SelectorFieldDraft): FieldSelector => ({
    attribute: draft.attribute.trim() !== "" ? draft.attribute.trim() : undefined,
    extraction_mode: draft.extractionMode,
    field_name: draft.fieldName.trim() !== "" ? draft.fieldName.trim() : undefined,
    fallback_selectors: draft.fallbackSelectorsRaw
        .split("\n")
        .map((selector) => selector.trim())
        .filter((selector) => selector !== ""),
    name: draft.name.trim(),
    required: draft.required,
    selector_type: draft.selectorType,
    selector_value: draft.selectorValue.trim(),
    text_mode: draft.extractionMode === "text" ? draft.textMode : undefined,
    transform: draft.transform.trim() !== "" ? draft.transform.trim() : undefined,
    default_value: draft.defaultValue.trim() !== "" ? draft.defaultValue.trim() : undefined,
    use_default_when_missing: draft.useDefaultWhenMissing,
    regex_pattern: draft.regexPattern.trim() !== "" ? draft.regexPattern.trim() : undefined,
    split_delimiter: draft.splitDelimiter.trim() !== "" ? draft.splitDelimiter.trim() : undefined,
    multi_value: draft.multiValue,
    partial_match: draft.partialMatch.trim() !== "" ? draft.partialMatch.trim() : undefined,
    comparison_operator: draft.comparisonOperator !== "" ? draft.comparisonOperator : undefined,
    comparison_value: draft.comparisonValue.trim() !== "" ? draft.comparisonValue.trim() : undefined,
});

export const parseSelectorConfigJson = (configJson?: string): FieldSelector[] => {
    if ((configJson ?? "").trim() === "") {
        return [];
    }

    const parsed = JSON.parse(configJson ?? "[]") as unknown;
    const fields = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { fields?: unknown; }).fields)
            ? (parsed as { fields: unknown[]; }).fields
            : [];

    return fields.map(normalizeFieldSelector);
};

export const stringifySelectorConfigJson = (fields: FieldSelector[]): string => {
    return JSON.stringify({ fields }, null, 2);
};

export const buildPreviewFieldMap = (fields: PropertyPreviewFieldResult[] | undefined): Map<string, PropertyPreviewFieldResult> => {
    return new Map((fields ?? []).map((field) => [field.name, field]));
};

export const validateSelectorDrafts = (drafts: SelectorFieldDraft[]): string[] => {
    const messages: string[] = [];
    const activeDrafts = drafts.filter((draft) => draft.name.trim() !== "");
    const names = new Set<string>();

    if (activeDrafts.length === 0) {
        return ["Add at least one named field before saving or previewing."];
    }

    activeDrafts.forEach((draft) => {
        const fieldName = draft.name.trim();
        if (names.has(fieldName)) {
            messages.push(`Field "${fieldName}" is listed more than once.`);
        }

        names.add(fieldName);

        if (draft.selectorValue.trim() === "") {
            messages.push(`Field "${fieldName}" needs a primary selector.`);
        }

        if (draft.extractionMode === "attribute" && draft.attribute.trim() === "") {
            messages.push(`Field "${fieldName}" needs an attribute name.`);
        }

        if (draft.comparisonOperator !== "" && draft.comparisonValue.trim() === "") {
            messages.push(`Field "${fieldName}" comparison needs a value.`);
        }
    });

    return messages;
};
