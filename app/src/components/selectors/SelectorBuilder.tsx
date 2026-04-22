import type { Dispatch, SetStateAction } from "react";

import type { PropertyPreviewFieldResult, SelectorType } from "@/services/properties/properties.types";
import type { SelectorFieldDraft } from "@/features/selectors/selectorSchema";

interface SelectorBuilderProps {
    readonly fields: SelectorFieldDraft[];
    readonly onChange: Dispatch<SetStateAction<SelectorFieldDraft[]>>;
    readonly previewByFieldName?: Map<string, PropertyPreviewFieldResult>;
}

const SELECTOR_TYPE_OPTIONS: Array<{ description: string; label: string; value: SelectorType; }> = [
    { description: "Best for classes, ids, and page structure.", label: "CSS", value: "css" },
    { description: "Use a CSS selector and read a named attribute like href or src.", label: "Attribute", value: "attribute" },
    { description: "Advanced mode for XPath selectors.", label: "XPath", value: "xpath" },
];

const TEXT_MODE_LABELS = {
    innerText: "Visible text",
    textContent: "All text content",
} as const;

const TRANSFORM_OPTIONS = [
    { label: "Keep text as-is", value: "" },
    { label: "Numbers only", value: "number" },
] as const;

const updateField = (fields: SelectorFieldDraft[], fieldId: string, patch: Partial<SelectorFieldDraft>): SelectorFieldDraft[] => {
    return fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field);
};

const previewTone = (field?: PropertyPreviewFieldResult): string => {
    if (field === undefined) {
        return "selector-builder__preview--idle";
    }

    return field.success ? "selector-builder__preview--success" : "selector-builder__preview--warning";
};

const previewLabel = (field?: PropertyPreviewFieldResult): string => {
    if (field === undefined) {
        return "Preview this field to confirm the selector.";
    }

    if (field.success) {
        if (field.match_count > 1) {
            return `${field.match_count} matches found. Using the first result.`;
        }

        return "Ready";
    }

    return field.message ?? "No value found yet.";
};

export const SelectorBuilder = ({ fields, onChange, previewByFieldName }: SelectorBuilderProps): JSX.Element => {
    return (
        <div className={"selector-builder"}>
            <div className={"selector-builder__intro"}>
                <p className={"selector-builder__eyebrow"}>{"Selector builder"}</p>
                <h3 className={"selector-builder__title"}>{"Tell Home Searcher where each value lives on the page."}</h3>
                <p className={"selector-builder__copy"}>
                    {"A selector points to the part of the page you want to read. Start with CSS for most pages, add a fallback if the first selector fails, and switch to XPath only when you need advanced targeting."}
                </p>
            </div>

            <div className={"selector-builder__tips"} role={"list"}>
                <div className={"selector-builder__tip"} role={"listitem"}>
                    <strong>{"CSS selector"}</strong>
                    <span>{'Selects page elements with classes or ids, for example ".price" or "#title".'}</span>
                </div>
                <div className={"selector-builder__tip"} role={"listitem"}>
                    <strong>{"Fallback selectors"}</strong>
                    <span>{"Add one selector per line and they will be tried in order if the main selector fails."}</span>
                </div>
                <div className={"selector-builder__tip"} role={"listitem"}>
                    <strong>{"Extraction"}</strong>
                    <span>{'Use "Text" for readable content, or "Attribute" when you need href, src, content, and similar values.'}</span>
                </div>
            </div>

            <div className={"item-list"}>
                {fields.map((field, index) => {
                    const preview = previewByFieldName?.get(field.name.trim());
                    const needsAttribute = field.extractionMode === "attribute" || field.selectorType === "attribute";

                    return (
                        <article className={"selector-builder__field"} key={field.id}>
                            <div className={"selector-builder__field-header"}>
                                <div>
                                    <p className={"selector-builder__field-index"}>{`Field ${index + 1}`}</p>
                                    <h4 className={"selector-builder__field-title"}>{field.name.trim() === "" ? "Untitled field" : field.name.trim()}</h4>
                                </div>
                                <div className={"selector-builder__field-actions"}>
                                    <label className={"selector-builder__toggle"}>
                                        <input
                                            checked={field.required}
                                            onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { required: event.target.checked })); }}
                                            type={"checkbox"}
                                        />
                                        <span>{"Required"}</span>
                                    </label>
                                    <button
                                        className={"button button--secondary"}
                                        onClick={() => { onChange((currentFields) => currentFields.filter((item) => item.id !== field.id)); }}
                                        type={"button"}
                                    >
                                        {"Remove"}
                                    </button>
                                </div>
                            </div>

                            <div className={"selector-builder__grid"}>
                                <label className={"field"}>
                                    <span className={"field__label"}>{"Field name"}</span>
                                    <input
                                        className={"field__control"}
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { name: event.target.value })); }}
                                        placeholder={"Price"}
                                        type={"text"}
                                        value={field.name}
                                    />
                                </label>

                                <label className={"field"}>
                                    <span className={"field__label"}>{"Selector type"}</span>
                                    <select
                                        className={"field__control"}
                                        onChange={(event) => {
                                            const selectorType = event.target.value as SelectorType;
                                            onChange((currentFields) => updateField(currentFields, field.id, {
                                                extractionMode: selectorType === "attribute" ? "attribute" : field.extractionMode,
                                                selectorType,
                                            }));
                                        }}
                                        value={field.selectorType}
                                    >
                                        {SELECTOR_TYPE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <p className={"field__hint"}>
                                        {SELECTOR_TYPE_OPTIONS.find((option) => option.value === field.selectorType)?.description}
                                    </p>
                                </label>

                                <label className={"field field--full-width"}>
                                    <span className={"field__label"}>{"Primary selector"}</span>
                                    <input
                                        className={"field__control"}
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { selectorValue: event.target.value })); }}
                                        placeholder={field.selectorType === "xpath" ? "//span[@class='price']" : ".price"}
                                        type={"text"}
                                        value={field.selectorValue}
                                    />
                                </label>

                                <label className={"field field--full-width"}>
                                    <span className={"field__label"}>{"Fallback selectors"}</span>
                                    <textarea
                                        className={"field__control selector-builder__textarea"}
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { fallbackSelectorsRaw: event.target.value })); }}
                                        placeholder={field.selectorType === "xpath" ? "//div[@data-price]" : ".price-alt\n[data-price]"}
                                        rows={3}
                                        value={field.fallbackSelectorsRaw}
                                    />
                                    <p className={"field__hint"}>{"Optional. Add one selector per line in the order you want to try them."}</p>
                                </label>

                                <label className={"field"}>
                                    <span className={"field__label"}>{"Extraction type"}</span>
                                    <select
                                        className={"field__control"}
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { extractionMode: event.target.value === "attribute" ? "attribute" : "text" })); }}
                                        value={field.extractionMode}
                                    >
                                        <option value={"text"}>{"Text"}</option>
                                        <option value={"attribute"}>{"Attribute"}</option>
                                    </select>
                                </label>

                                {field.extractionMode === "text" ? (
                                    <label className={"field"}>
                                        <span className={"field__label"}>{"Text to read"}</span>
                                        <select
                                            className={"field__control"}
                                            onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { textMode: event.target.value === "textContent" ? "textContent" : "innerText" })); }}
                                            value={field.textMode}
                                        >
                                            <option value={"innerText"}>{TEXT_MODE_LABELS.innerText}</option>
                                            <option value={"textContent"}>{TEXT_MODE_LABELS.textContent}</option>
                                        </select>
                                    </label>
                                ) : null}

                                {needsAttribute ? (
                                    <label className={"field"}>
                                        <span className={"field__label"}>{"Attribute name"}</span>
                                        <input
                                            className={"field__control"}
                                            onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { attribute: event.target.value })); }}
                                            placeholder={"href"}
                                            type={"text"}
                                            value={field.attribute}
                                        />
                                    </label>
                                ) : null}

                                <label className={"field"}>
                                    <span className={"field__label"}>{"Value cleanup"}</span>
                                    <select
                                        className={"field__control"}
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { transform: event.target.value })); }}
                                        value={field.transform}
                                    >
                                        {TRANSFORM_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className={`selector-builder__preview ${previewTone(preview)}`}>
                                <div>
                                    <p className={"selector-builder__preview-label"}>{"Preview status"}</p>
                                    <strong className={"selector-builder__preview-title"}>{previewLabel(preview)}</strong>
                                </div>
                                <div className={"selector-builder__preview-meta"}>
                                    {preview?.matched_selector !== undefined ? <span>{`Used ${preview.matched_selector}`}</span> : null}
                                    {preview?.value !== undefined && preview.value !== "" ? <code>{preview.value}</code> : null}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};
