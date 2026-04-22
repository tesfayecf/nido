import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { PropertyPreviewFieldResult, SelectorType } from "@/services/properties/properties.types";
import type { SelectorFieldDraft } from "@/features/selectors/selectorSchema";

interface SelectorBuilderProps {
    readonly fields: SelectorFieldDraft[];
    readonly onChange: Dispatch<SetStateAction<SelectorFieldDraft[]>>;
    readonly previewByFieldName?: Map<string, PropertyPreviewFieldResult>;
}

const SELECTOR_TYPE_OPTIONS: { description: string; label: string; value: SelectorType; }[] = [
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
    { label: "Trim whitespace", value: "trim" },
    { label: "Lowercase", value: "lowercase" },
    { label: "Uppercase", value: "uppercase" },
    { label: "Integer (digits only)", value: "integer" },
    { label: "Decimal number", value: "decimal" },
    { label: "Currency amount", value: "currency" },
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
    const [helpOpen, setHelpOpen] = useState(false);

    return (
        <div className={"selector-builder"}>
            <div className={"selector-builder__intro"}>
                <div className={"selector-builder__intro-header"}>
                    <p className={"selector-builder__eyebrow"}>{"Selector builder"}</p>
                    <Button onClick={() => { setHelpOpen(true); }} size={"small"} variant={"secondary"}>
                        {"How to use"}
                    </Button>
                </div>
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
                                    <Button
                                        onClick={() => { onChange((currentFields) => currentFields.filter((item) => item.id !== field.id)); }}
                                        variant={"secondary"}
                                    >
                                        {"Remove"}
                                    </Button>
                                </div>
                            </div>

                            <div className={"selector-builder__grid"}>
                                <Field label={"Field name"}>
                                    <Input
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { name: event.target.value })); }}
                                        placeholder={"Price"}
                                        type={"text"}
                                        value={field.name}
                                    />
                                </Field>

                                <Field
                                    hint={SELECTOR_TYPE_OPTIONS.find((option) => option.value === field.selectorType)?.description}
                                    label={"Selector type"}
                                >
                                    <Select
                                        onChange={(event) => {
                                            const selectorType = event.target.value as SelectorType;
                                            onChange((currentFields) => updateField(currentFields, field.id, {
                                                extractionMode: selectorType === "attribute" ? "attribute" : field.extractionMode,
                                                selectorType,
                                            }));
                                        }}
                                        value={field.selectorType}
                                    >
                                        {SELECTOR_TYPE_OPTIONS.map((option) => {
                                            return <option key={option.value} value={option.value}>{option.label}</option>;
                                        })}
                                    </Select>
                                </Field>

                                <Field fullWidth label={"Primary selector"}>
                                    <Input
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { selectorValue: event.target.value })); }}
                                        placeholder={field.selectorType === "xpath" ? "//span[@data-price]" : ".price"}
                                        type={"text"}
                                        value={field.selectorValue}
                                    />
                                </Field>

                                <Field
                                    fullWidth
                                    hint={"Optional. Add one selector per line in the order you want to try them."}
                                    label={"Fallback selectors"}
                                >
                                    <Textarea
                                        className={"selector-builder__textarea"}
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { fallbackSelectorsRaw: event.target.value })); }}
                                        placeholder={field.selectorType === "xpath" ? "//div[@data-price]" : ".price-alt\n[data-price]"}
                                        rows={3}
                                        value={field.fallbackSelectorsRaw}
                                    />
                                </Field>

                                <Field label={"Extraction type"}>
                                    <Select
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { extractionMode: event.target.value === "attribute" ? "attribute" : "text" })); }}
                                        value={field.extractionMode}
                                    >
                                        <option value={"text"}>{"Text"}</option>
                                        <option value={"attribute"}>{"Attribute"}</option>
                                    </Select>
                                </Field>

                                {field.extractionMode === "text" ? (
                                    <Field label={"Text to read"}>
                                        <Select
                                            onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { textMode: event.target.value === "textContent" ? "textContent" : "innerText" })); }}
                                            value={field.textMode}
                                        >
                                            <option value={"innerText"}>{TEXT_MODE_LABELS.innerText}</option>
                                            <option value={"textContent"}>{TEXT_MODE_LABELS.textContent}</option>
                                        </Select>
                                    </Field>
                                ) : null}

                                {needsAttribute ? (
                                    <Field label={"Attribute name"}>
                                        <Input
                                            onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { attribute: event.target.value })); }}
                                            placeholder={"href"}
                                            type={"text"}
                                            value={field.attribute}
                                        />
                                    </Field>
                                ) : null}

                                <Field label={"Value cleanup"}>
                                    <Select
                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { transform: event.target.value })); }}
                                        value={field.transform}
                                    >
                                        {TRANSFORM_OPTIONS.map((option) => {
                                            return <option key={option.value} value={option.value}>{option.label}</option>;
                                        })}
                                    </Select>
                                </Field>
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
            <Dialog
                actions={<Button onClick={() => { setHelpOpen(false); }}>{"Got it"}</Button>}
                className={"selector-builder__help-dialog"}
                description={"Quick guide for creating stable selectors, testing them, and fixing common issues."}
                onOpenChange={setHelpOpen}
                open={helpOpen}
                title={"How to use the selector tool"}
            >
                <div className={"selector-builder__help-body"}>
                    <section className={"selector-builder__help-section"}>
                        <h3>{"Recommended workflow"}</h3>
                        <ol className={"selector-builder__help-list"}>
                            <li>{"Open the property page and inspect the value you want to track, such as price or title."}</li>
                            <li>{"Start with a simple CSS selector that targets that value, like .price or [data-testid='price']."}</li>
                            <li>{"Use Preview to confirm the extracted value before saving."}</li>
                            <li>{"Add a fallback selector when the same value appears in more than one possible place on the page."}</li>
                        </ol>
                    </section>
                    <section className={"selector-builder__help-section"}>
                        <h3>{"Field options"}</h3>
                        <ul className={"selector-builder__help-list"}>
                            <li><strong>{"Selector type:"}</strong>{" Use CSS first. Use Attribute when you need href, src, or content. Use XPath only when CSS cannot target the element reliably."}</li>
                            <li><strong>{"Fallback selectors:"}</strong>{" Add one selector per line. Home Searcher tries them from top to bottom until one works."}</li>
                            <li><strong>{"Extraction type:"}</strong>{' Choose "Text" for visible page content, or "Attribute" to read an HTML attribute.'}</li>
                            <li><strong>{"Value cleanup:"}</strong>{" Use Currency or Decimal for prices, Integer for counts, and Trim when you only need whitespace cleanup."}</li>
                        </ul>
                    </section>
                    <section className={"selector-builder__help-section"}>
                        <h3>{"Troubleshooting"}</h3>
                        <ul className={"selector-builder__help-list"}>
                            <li>{"If Preview says no selector matched, simplify the selector and test again."}</li>
                            <li>{"If multiple matches are found, make the selector more specific so it points to only one element."}</li>
                            <li>{"If the page changes often, prefer stable ids, data-* attributes, or add a fallback selector."}</li>
                        </ul>
                    </section>
                </div>
            </Dialog>
        </div>
    );
};
