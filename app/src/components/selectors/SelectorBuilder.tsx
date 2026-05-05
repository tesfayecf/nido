/**
 * File: app/src/components/selectors/SelectorBuilder.tsx
 *
 * Purpose:
 * Provides a reusable feature-specific React component used by frontend pages.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, react, @/components/ui/Button, @/components/ui/ContextualHelp, @/components/ui/Dialog, @/components/ui/Field, @/components/ui/Input, @/components/ui/Select; additional imports omitted for brevity
 * - Typed props or parameters declared in this file
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - @/components/ui/Button
 * - @/components/ui/ContextualHelp
 * - @/components/ui/Dialog
 * - @/components/ui/Field
 * - @/components/ui/Input
 * - @/components/ui/Select
 * - @/components/ui/Textarea
 * - @/features/selectors/selectorSchema
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /app/docs/components.md
 * - /app/docs/ui-architecture.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import { Fragment, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/Button";
import { ContextualHelp } from "@/components/ui/ContextualHelp";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { SelectorFieldDraft } from "@/features/selectors/selectorSchema";
import type { FieldDefinitionUsage } from "@/services/fields/fields.types";
import type { PropertyPreviewFieldResult, SelectorType } from "@/services/properties/properties.types";

interface SelectorBuilderFieldMetadata {
    readonly currentValue?: string;
    readonly origin: "manual" | "template";
    readonly reason: string;
    readonly sourceLabel: string;
    readonly status: "matched" | "overridden" | "stale" | "unmatched";
}

interface SelectorBuilderProps {
    readonly fields: SelectorFieldDraft[];
    readonly fieldDefinitions?: FieldDefinitionUsage[];
    readonly fieldMetadataById?: Record<string, SelectorBuilderFieldMetadata>;
    readonly onChange: Dispatch<SetStateAction<SelectorFieldDraft[]>>;
    readonly onOverrideField?: (fieldId: string) => void;
    readonly onRevertField?: (fieldId: string) => void;
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

const SELECTOR_TABLE_COLUMN_COUNT = 6;

type ExtractionStrategy = "delimiter" | "direct" | "partial" | "regex";

const EXTRACTION_STRATEGIES: { description: string; example: string; label: string; value: ExtractionStrategy; }[] = [
    { description: "Use the selected text or attribute value exactly as captured.", example: "Example: .price → €425,000", label: "Direct Mapping", value: "direct" },
    { description: "Capture a specific pattern or capture group from the selected value.", example: "Example: (\\d+[,.]?\\d*)", label: "Regex", value: "regex" },
    { description: "Keep the portion of the captured value that contains expected text.", example: "Example: asking price", label: "Partial Match", value: "partial" },
    { description: "Split the captured value around a delimiter before returning it.", example: "Example: comma in €425,000, Dublin", label: "Delimiter-Based", value: "delimiter" },
] as const;

const getExtractionStrategy = (field: SelectorFieldDraft): ExtractionStrategy => {
    if (field.regexPattern.trim() !== "") {
        return "regex";
    }

    if (field.partialMatch.trim() !== "") {
        return "partial";
    }

    if (field.splitDelimiter.trim() !== "" || field.multiValue) {
        return "delimiter";
    }

    return "direct";
};

/**
 * Purpose: Executes the getExtractionMethodLabel operation for app/src/components/selectors/SelectorBuilder.tsx.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const getExtractionMethodLabel = (field: SelectorFieldDraft): string => {
    const strategy = EXTRACTION_STRATEGIES.find((option) => option.value === getExtractionStrategy(field));
    return strategy?.label ?? "Direct Mapping";
};

const updateField = (fields: SelectorFieldDraft[], fieldId: string, patch: Partial<SelectorFieldDraft>): SelectorFieldDraft[] => {
    return fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field);
};

const resetStrategyInputs = (field: SelectorFieldDraft, strategy: ExtractionStrategy): Partial<SelectorFieldDraft> => {
    switch (strategy) {
        case "regex":
            return { multiValue: false, partialMatch: "", regexPattern: field.regexPattern, splitDelimiter: "" };
        case "partial":
            return { multiValue: false, partialMatch: field.partialMatch, regexPattern: "", splitDelimiter: "" };
        case "delimiter":
            return { multiValue: field.multiValue, partialMatch: "", regexPattern: "", splitDelimiter: field.splitDelimiter };
        case "direct":
        default:
            return { multiValue: false, partialMatch: "", regexPattern: "", splitDelimiter: "" };
    }
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

const getFieldTypeLabel = (field: SelectorFieldDraft): string => {
    return field.extractionMode === "attribute"
        ? `Attribute · ${field.selectorType.toUpperCase()}`
        : `Text · ${field.selectorType.toUpperCase()}`;
};

const getFieldOriginLabel = (metadata: SelectorBuilderFieldMetadata): string => {
    return metadata.origin === "template" ? "Template" : "User-created";
};

const getFieldStatusLabel = (metadata: SelectorBuilderFieldMetadata): string => {
    switch (metadata.status) {
        case "matched":
            return "Matched (Template Active)";
        case "overridden":
            return "Overridden (Property Level)";
        case "stale":
            return "Stale";
        case "unmatched":
        default:
            return "Unmatched";
    }
};

const getFieldRoleLabel = (role: SelectorFieldDraft["fieldRole"]): string => role === "tracked" ? "Tracked" : "Prefill";

/**
 * Purpose: Renders the SelectorBuilder UI boundary documented for app/src/components/selectors/SelectorBuilder.tsx.
 * Rendering logic: Composes typed props, shared UI primitives, and service-derived state into accessible markup.
 * State management: Uses local React state, external stores, or React Query only where declared in the implementation below.
 * Side effects: Limits side effects to documented hooks, event handlers, and service calls visible in this module.
 * Performance: Keeps derived rendering explicit so memoization, virtualization, or loading boundaries can be audited safely.
 */
export const SelectorBuilder = ({
    fieldDefinitions,
    fieldMetadataById,
    fields,
    onChange,
    onOverrideField,
    onRevertField,
    previewByFieldName,
}: SelectorBuilderProps): JSX.Element => {
    const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [tipsOpen, setTipsOpen] = useState(false);
    const [openFallbacks, setOpenFallbacks] = useState<Set<string>>(new Set());
    const previousFieldIdsRef = useRef<string[]>(fields.map((field) => field.id));
    const globalFields = [...fieldDefinitions ?? []].sort((left, right) => left.display_name.localeCompare(right.display_name));
    const builderSummary = "Scan field role, origin, and status first, then open a row to edit selectors, fallbacks, cleanup rules, and preview details.";

    useEffect(() => {
        const previousFieldIds = previousFieldIdsRef.current;
        const nextFieldIds = fields.map((field) => field.id);
        const addedFieldId = nextFieldIds.find((fieldId) => !previousFieldIds.includes(fieldId));
        if (addedFieldId !== undefined) {
            setExpandedFieldId(addedFieldId);
        } else if (expandedFieldId !== null && !nextFieldIds.includes(expandedFieldId)) {
            setExpandedFieldId(null);
        }

        previousFieldIdsRef.current = nextFieldIds;
    }, [expandedFieldId, fields]);

    const toggleFallback = (fieldId: string): void => {
        setOpenFallbacks((previous) => {
            const next = new Set(previous);
            if (next.has(fieldId)) {
                next.delete(fieldId);
            } else {
                next.add(fieldId);
            }

            return next;
        });
    };

    return (
        <div className={"selector-builder"}>
            <div className={"selector-builder__intro"}>
                <div className={"selector-builder__intro-header"}>
                    <p className={"selector-builder__eyebrow"}>{"Selector builder"}</p>
                    <div className={"action-group"}>
                        <Button onClick={() => { setTipsOpen((previous) => !previous); }} size={"small"} variant={"ghost"}>
                            {tipsOpen ? "Hide tips ▴" : "Tips ▾"}
                        </Button>
                        <Button onClick={() => { setHelpOpen(true); }} size={"small"} variant={"secondary"}>
                            {"How to use"}
                        </Button>
                    </div>
                </div>
                <div className={"selector-builder__title-row"}>
                    <h3 className={"selector-builder__title"}>{"Manage fields from one compact table, then expand only what you need."}</h3>
                    <ContextualHelp content={builderSummary} title={"Selector builder overview"} />
                </div>
            </div>

            {tipsOpen ? (
                <div className={"selector-builder__tips"} role={"list"}>
                    <div className={"selector-builder__tip"} role={"listitem"}>
                        <strong>{"Field source"}</strong>
                        <span>{"Template fields stay marked so it is clear which rows came from a template and which were added manually."}</span>
                    </div>
                    <div className={"selector-builder__tip"} role={"listitem"}>
                        <strong>{"Progressive disclosure"}</strong>
                        <span>{"Open one row at a time to keep large configurations scannable without hiding any editing power."}</span>
                    </div>
                    <div className={"selector-builder__tip"} role={"listitem"}>
                        <strong>{"Extraction"}</strong>
                        <span>{'Use "Text" for readable content, or "Attribute" when you need href, src, content, and similar values.'}</span>
                    </div>
                </div>
            ) : null}

            <div className={"selector-builder__table-shell"}>
                <table className={"selector-builder__table"}>
                    <thead>
                        <tr>
                            <th scope={"col"}>{"Field"}</th>
                            <th scope={"col"}>{"Role"}</th>
                            <th scope={"col"}>{"Type"}</th>
                            <th scope={"col"}>{"Source"}</th>
                            <th scope={"col"}>{"Status"}</th>
                            <th scope={"col"}>{"Actions"}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fields.map((field, index) => {
                            const preview = previewByFieldName?.get(field.name.trim());
                            const needsAttribute = field.extractionMode === "attribute" || field.selectorType === "attribute";
                            const expanded = expandedFieldId === field.id;
                            const activeExtractionStrategy = EXTRACTION_STRATEGIES.find((option) => option.value === getExtractionStrategy(field));
                            const metadata = fieldMetadataById?.[field.id] ?? {
                                origin: "manual",
                                reason: "No template linkage is saved for this field.",
                                sourceLabel: "Manual/property field",
                                status: "unmatched",
                            } satisfies SelectorBuilderFieldMetadata;

                            return (
                                <Fragment key={field.id}>
                                    <tr className={expanded ? "selector-builder__summary-row selector-builder__summary-row--expanded" : "selector-builder__summary-row"}>
                                        <td>
                                            <button
                                                aria-expanded={expanded}
                                                className={"selector-builder__expand"}
                                                onClick={() => {
                                                    setExpandedFieldId((current) => current === field.id ? null : field.id);
                                                }}
                                                type={"button"}
                                            >
                                                <span aria-hidden={"true"} className={"selector-builder__expand-icon"}>
                                                    {expanded ? "▾" : "▸"}
                                                </span>
                                                <span>
                                                    <span className={"selector-builder__field-index"}>{`Field ${index + 1}`}</span>
                                                    <strong className={"selector-builder__field-name"}>{field.name.trim() === "" ? "Untitled field" : field.name.trim()}</strong>
                                                </span>
                                            </button>
                                        </td>
                                        <td>
                                            <span className={`selector-builder__meta-badge selector-builder__meta-badge--${field.fieldRole}`}>
                                                {getFieldRoleLabel(field.fieldRole)}
                                            </span>
                                        </td>
                                        <td>
                                            <span>{getFieldTypeLabel(field)}</span>
                                            <span className={"selector-builder__source-label"}>{metadata.currentValue ?? "No current value yet"}</span>
                                        </td>
                                        <td>
                                            <span className={`selector-builder__meta-badge selector-builder__meta-badge--${metadata.origin}`}>
                                                {getFieldOriginLabel(metadata)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`selector-builder__meta-badge selector-builder__meta-badge--${metadata.status}`}>
                                                {getFieldStatusLabel(metadata)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={"selector-builder__summary-actions"}>
                                                <span className={"muted-copy"}>{field.required ? "Required" : "Optional"}</span>
                                                <Button
                                                    onClick={() => {
                                                        onChange((currentFields) => currentFields.filter((item) => item.id !== field.id));
                                                    }}
                                                    size={"small"}
                                                    variant={"secondary"}
                                                >
                                                    {"Remove"}
                                                </Button>
                                                {metadata.status === "matched" && onOverrideField !== undefined ? (
                                                    <Button onClick={() => { onOverrideField(field.id); }} size={"small"} variant={"ghost"}>
                                                        {"Override"}
                                                    </Button>
                                                ) : null}
                                                {(metadata.status === "overridden" || metadata.status === "stale") && onRevertField !== undefined ? (
                                                    <Button onClick={() => { onRevertField(field.id); }} size={"small"} variant={"ghost"}>
                                                        {metadata.status === "stale" ? "Review / revert" : "Revert to template"}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                    {expanded ? (
                                        <tr className={"selector-builder__details-row"}>
                                            <td colSpan={SELECTOR_TABLE_COLUMN_COUNT}>
                                                <div className={"selector-builder__field"}>
                                                    <div className={"selector-builder__field-header"}>
                                                        <div>
                                                            <p className={"selector-builder__field-index"}>{`Field ${index + 1}`}</p>
                                                            <h4 className={"selector-builder__field-title"}>{field.name.trim() === "" ? "Untitled field" : field.name.trim()}</h4>
                                                        </div>
                                                        <label className={"selector-builder__toggle"}>
                                                            <input
                                                                checked={field.required}
                                                                onChange={(event) => {
                                                                    onChange((currentFields) => updateField(currentFields, field.id, { required: event.target.checked }));
                                                                }}
                                                                type={"checkbox"}
                                                            />
                                                            <span>{"Required"}</span>
                                                        </label>
                                                    </div>

                                                    <div className={"selector-builder__grid"}>
                                                        <div className={"selector-builder__state-card"}>
                                                            <span className={`selector-builder__meta-badge selector-builder__meta-badge--${metadata.status}`}>
                                                                {getFieldStatusLabel(metadata)}
                                                            </span>
                                                            <strong>{metadata.sourceLabel}</strong>
                                                            <span>{metadata.reason}</span>
                                                        </div>
                                                        <Field label={"Field name"}>
                                                            <Input
                                                                onChange={(event) => {
                                                                    const nextName = event.target.value;
                                                                    onChange((currentFields) => updateField(currentFields, field.id, {
                                                                        fieldRole: nextName.trim().toLowerCase() === "price" ? "tracked" : field.fieldRole,
                                                                        name: nextName,
                                                                        required: nextName.trim().toLowerCase() === "price" ? true : field.required,
                                                                    }));
                                                                }}
                                                                placeholder={"Price"}
                                                                type={"text"}
                                                                value={field.name}
                                                            />
                                                        </Field>

                                                        <Field
                                                            hint={"Use Prefill for mostly stable listing facts. Use Tracked for values you want Nido to compare on each run."}
                                                            label={"Field role"}
                                                        >
                                                            <Select
                                                                disabled={field.name.trim().toLowerCase() === "price"}
                                                                onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { fieldRole: event.target.value as SelectorFieldDraft["fieldRole"] })); }}
                                                                value={field.fieldRole}
                                                            >
                                                                <option value={"prefill"}>{"Prefill"}</option>
                                                                <option value={"tracked"}>{"Tracked"}</option>
                                                            </Select>
                                                        </Field>

                                                        <Field
                                                            hint={"Optional. Map this output to a shared canonical field for cross-property analytics."}
                                                            label={"Global field"}
                                                        >
                                                            <Select
                                                                onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { fieldName: event.target.value })); }}
                                                                value={field.fieldName}
                                                            >
                                                                <option value={""}>{"Unassigned"}</option>
                                                                {globalFields.map((option) => <option key={option.id} value={option.name}>{option.display_name}</option>)}
                                                            </Select>
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
                                                                {SELECTOR_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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

                                                        <div className={"field field--full-width"}>
                                                            <Button
                                                                onClick={() => { toggleFallback(field.id); }}
                                                                size={"small"}
                                                                variant={"ghost"}
                                                            >
                                                                {openFallbacks.has(field.id) ? "Hide fallback selectors ▴" : "Add fallback selectors ▾"}
                                                            </Button>
                                                            {openFallbacks.has(field.id) ? (
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
                                                            ) : null}
                                                        </div>

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
                                                                {TRANSFORM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                            </Select>
                                                        </Field>

                                                        <Field label={"Use default if missing"} variant={"checkbox"}>
                                                            <input
                                                                checked={field.useDefaultWhenMissing}
                                                                onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { useDefaultWhenMissing: event.target.checked })); }}
                                                                type={"checkbox"}
                                                            />
                                                        </Field>

                                                        {field.useDefaultWhenMissing ? (
                                                            <Field hint={"Used when the field is missing or empty."} label={"Default value"}>
                                                                <Input
                                                                    onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { defaultValue: event.target.value })); }}
                                                                    placeholder={"Fallback value"}
                                                                    type={"text"}
                                                                    value={field.defaultValue}
                                                                />
                                                            </Field>
                                                        ) : null}

                                                        <section className={"selector-builder__strategy-panel"}>
                                                            <Field
                                                                fullWidth
                                                                hint={[
                                                                    "Choose one post-capture strategy. Switching clears inputs that do not apply to the new strategy.",
                                                                    activeExtractionStrategy?.description,
                                                                    activeExtractionStrategy?.example,
                                                                ].filter(Boolean).join(" ")}
                                                                label={"Extraction strategy"}
                                                            >
                                                                <Select
                                                                    onChange={(event) => {
                                                                        const strategy = event.target.value as ExtractionStrategy;
                                                                        onChange((currentFields) => updateField(currentFields, field.id, resetStrategyInputs(field, strategy)));
                                                                    }}
                                                                    value={getExtractionStrategy(field)}
                                                                >
                                                                    {EXTRACTION_STRATEGIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                                </Select>
                                                            </Field>
                                                            {getExtractionStrategy(field) === "regex" ? (
                                                                <Field fullWidth hint={"Capture the first regex match or capture group."} label={"Regex Pattern"}>
                                                                    <Input
                                                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { regexPattern: event.target.value })); }}
                                                                        placeholder={"\\d+[.,]?\\d*"}
                                                                        type={"text"}
                                                                        value={field.regexPattern}
                                                                    />
                                                                </Field>
                                                            ) : null}
                                                            {getExtractionStrategy(field) === "partial" ? (
                                                                <Field fullWidth hint={"Only values containing this text are kept."} label={"Partial Match Text"}>
                                                                    <Input
                                                                        onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { partialMatch: event.target.value })); }}
                                                                        placeholder={"Text to keep"}
                                                                        type={"text"}
                                                                        value={field.partialMatch}
                                                                    />
                                                                </Field>
                                                            ) : null}
                                                            {getExtractionStrategy(field) === "delimiter" ? (
                                                                <>
                                                                    <Field fullWidth hint={"Split captured text and keep the first value unless multi-value is enabled."} label={"Delimiter Character"}>
                                                                        <Input
                                                                            onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { splitDelimiter: event.target.value })); }}
                                                                            placeholder={","}
                                                                            type={"text"}
                                                                            value={field.splitDelimiter}
                                                                        />
                                                                    </Field>
                                                                    <Field fullWidth label={"Return multiple values"} variant={"checkbox"}>
                                                                        <input
                                                                            checked={field.multiValue}
                                                                            onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { multiValue: event.target.checked })); }}
                                                                            type={"checkbox"}
                                                                        />
                                                                    </Field>
                                                                </>
                                                            ) : null}
                                                        </section>

                                                        <Field hint={"Optional boolean output such as price > 500000."} label={"Boolean comparison"}>
                                                            <Select
                                                                onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { comparisonOperator: event.target.value as SelectorFieldDraft["comparisonOperator"] })); }}
                                                                value={field.comparisonOperator}
                                                            >
                                                                <option value={""}>{"None"}</option>
                                                                <option value={"eq"}>{"Equals"}</option>
                                                                <option value={"gt"}>{"Greater than"}</option>
                                                                <option value={"lt"}>{"Less than"}</option>
                                                                <option value={"contains"}>{"Contains"}</option>
                                                            </Select>
                                                        </Field>

                                                        {field.comparisonOperator !== "" ? (
                                                            <Field label={"Comparison value"}>
                                                                <Input
                                                                    onChange={(event) => { onChange((currentFields) => updateField(currentFields, field.id, { comparisonValue: event.target.value })); }}
                                                                    placeholder={"500000"}
                                                                    type={"text"}
                                                                    value={field.comparisonValue}
                                                                />
                                                            </Field>
                                                        ) : null}
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
                                                </div>
                                            </td>
                                        </tr>
                                    ) : null}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
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
                            <li><strong>{"Fallback selectors:"}</strong>{" Add one selector per line. Nido tries them from top to bottom until one works."}</li>
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
