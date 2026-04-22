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
    readonly fallbackSelectorsRaw: string;
    readonly id: string;
    readonly name: string;
    readonly required: boolean;
    readonly selectorType: SelectorType;
    readonly selectorValue: string;
    readonly textMode: TextMode;
    readonly transform: string;
}

interface LegacyFieldSelector {
    readonly attribute?: string;
    readonly extraction_mode?: ExtractionMode;
    readonly fallback_selectors?: string[];
    readonly name?: string;
    readonly required?: boolean;
    readonly selector_type?: SelectorType;
    readonly selector_value?: string;
    readonly selectors?: string[];
    readonly text_mode?: TextMode;
    readonly transform?: string;
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
        fallback_selectors: raw.fallback_selectors?.map((selector) => selector.trim()).filter((selector) => selector !== "")
            ?? selectors.slice(1),
        name: (raw.name ?? "").trim(),
        required: raw.required ?? false,
        selector_type: normalizeSelectorType(raw.selector_type, extractionMode),
        selector_value: selectorValue,
        text_mode: raw.text_mode ?? DEFAULT_TEXT_MODE,
        transform: raw.transform?.trim() !== "" ? raw.transform?.trim() : undefined,
    };
};

export const createEmptySelectorDraft = (): SelectorFieldDraft => ({
    attribute: "",
    extractionMode: "text",
    fallbackSelectorsRaw: "",
    id: crypto.randomUUID(),
    name: "",
    required: false,
    selectorType: "css",
    selectorValue: "",
    textMode: DEFAULT_TEXT_MODE,
    transform: "",
});

export const selectorToDraft = (selector: FieldSelector): SelectorFieldDraft => ({
    attribute: selector.attribute ?? "",
    extractionMode: selector.extraction_mode,
    fallbackSelectorsRaw: (selector.fallback_selectors ?? []).join("\n"),
    id: crypto.randomUUID(),
    name: selector.name,
    required: selector.required,
    selectorType: selector.selector_type,
    selectorValue: selector.selector_value,
    textMode: selector.text_mode ?? DEFAULT_TEXT_MODE,
    transform: selector.transform ?? "",
});

export const draftToSelector = (draft: SelectorFieldDraft): FieldSelector => ({
    attribute: draft.attribute.trim() !== "" ? draft.attribute.trim() : undefined,
    extraction_mode: draft.extractionMode,
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
});

export const parseSelectorConfigJson = (configJson?: string): FieldSelector[] => {
    if ((configJson ?? "").trim() === "") {
        return [];
    }

    const parsed = JSON.parse(configJson ?? "[]") as LegacyFieldSelector[] | { fields?: LegacyFieldSelector[]; };
    const fields = Array.isArray(parsed) ? parsed : parsed.fields ?? [];
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
    });

    return messages;
};
