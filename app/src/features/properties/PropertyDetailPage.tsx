import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { SelectorBuilder } from "@/components/selectors/SelectorBuilder";
import { ActionGroup } from "@/components/ui/ActionGroup";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextualHelp } from "@/components/ui/ContextualHelp";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { KeyValueGrid, KeyValuePair } from "@/components/ui/KeyValueGrid";
import { ListRow, ListRowMain } from "@/components/ui/ListRow";
import { PageCard } from "@/components/ui/PageCard";
import { PageStack } from "@/components/ui/PageStack";
import { RowActions } from "@/components/ui/RowActions";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { CopyButton } from "@/components/ui/CopyButton";
import { useToast } from "@/components/ui/ToastProvider";
import { TagBadge } from "@/components/tags/TagBadge";
import { TagPicker } from "@/components/tags/TagPicker";
import { PriceHistoryChart } from "@/features/properties/PriceHistoryChart";
import { buildPriceIntelligence, formatDecisionStatus } from "@/features/properties/priceIntelligence";
import { buildPriceHistoryPoints } from "@/features/properties/propertyHistory";
import { downloadPropertySnapshotExport } from "@/features/properties/propertyExport";
import { readWorkspaceSettings } from "@/features/settings/workspaceSettings";
import { fieldKeys } from "@/services/fields/fields.keys";
import { listFields } from "@/services/fields/fields.service";
import { PropertyAlertCreateDialog } from "@/features/engagement/PropertyAlertCreateDialog";
import {
    SCHEDULE_PRESETS,
    durationDraftFromSeconds,
    durationDraftToSeconds,
    formatDurationFromSeconds,
    type DurationUnit,
} from "@/features/properties/propertySchedule";
import { diffPropertyConfigs } from "@/features/properties/configDiff";
import { getRuleTypeLabel, getRuleTypeLogic } from "@/services/alert-rules/alert-rules.constants";
import { alertRuleKeys } from "@/services/alert-rules/alert-rules.keys";
import { listAlertRules } from "@/services/alert-rules/alert-rules.service";
import { runKeys } from "@/services/backoffice-runs/runs.keys";
import { sourceKeys } from "@/services/backoffice-sources/sources.keys";
import { listSources } from "@/services/backoffice-sources/sources.service";
import { bookmarkKeys } from "@/services/bookmarks/bookmarks.keys";
import { createBookmark, deleteBookmark, listBookmarks } from "@/services/bookmarks/bookmarks.service";
import { readNonNegativeNumber } from "@/lib/forms/number";
import { formatDateTime } from "@/lib/format/date";
import { notificationKeys } from "@/services/notifications/notifications.keys";
import { propertyKeys } from "@/services/properties/properties.keys";
import {
    buildFieldSelectorSignature,
    buildPreviewFieldMap,
    createDefaultSelectorDrafts,
    createEmptySelectorDraft,
    draftToSelector,
    getFieldMappingState,
    parseSelectorConfigJson,
    selectorToDraft,
    validateSelectorDrafts,
    type SelectorFieldDraft,
} from "@/features/selectors/selectorSchema";
import {
    createProperty,
    deleteProperty,
    getProperty,
    getPropertyConfig,
    getPropertySummary,
    listPropertySummaries,
    listPropertyConfigVersions,
    ingestProperty,
    listPropertyRuns,
    listPropertySnapshots,
    previewExtraction,
    rollbackPropertyConfig,
    updateProperty,
    upsertPropertyConfig,
} from "@/services/properties/properties.service";
import type { PropertyAttachment, PropertyManualData, PropertyMetadata, PropertyPreviewFieldResult, PropertyReference, PropertyRunStatus, PropertyTrackingMode } from "@/services/properties/properties.types";
import { tagKeys } from "@/services/tags/tags.keys";
import { listPropertyTags, setPropertyTags } from "@/services/tags/tags.service";

const PROPERTY_RUNS_REFETCH_INTERVAL_MS = 5000;
const AUTOFILL_DEBOUNCE_MS = 300;
const MIN_RETRY_BACKOFF_MS = 500;
const BASIS_POINTS_PER_PERCENT = 100;
const OVERVIEW_ATTRIBUTE_PREVIEW_LIMIT = 4;

interface PropertyMetadataDraft {
    readonly acquisitionNotes: string;
    readonly attachmentsText: string;
    readonly businessStage: string;
    readonly dealThesis: string;
    readonly expectedRent: string;
    readonly expectedYieldPercent: string;
    readonly externalReferencesText: string;
    readonly pauseReason: string;
    readonly paused: boolean;
    readonly priorityLevel: string;
    readonly targetPrice: string;
}

type ManualAttributeType = "numeric" | "text";

interface ManualAttributeDraft {
    readonly id: string;
    readonly name: string;
    readonly type: ManualAttributeType;
    readonly value: string;
}

interface DecisionEntry {
    readonly label: string;
    readonly timestamp?: string;
    readonly value: string;
}

const EMPTY_METADATA_DRAFT: PropertyMetadataDraft = {
    acquisitionNotes: "",
    attachmentsText: "",
    businessStage: "",
    dealThesis: "",
    expectedRent: "",
    expectedYieldPercent: "",
    externalReferencesText: "",
    pauseReason: "",
    paused: false,
    priorityLevel: "",
    targetPrice: "",
};

const DEFAULT_MANUAL_ATTRIBUTES: readonly ManualAttributeDraft[] = [
    { id: "manual-price", name: "price", type: "numeric", value: "" },
    { id: "manual-size", name: "size", type: "numeric", value: "" },
    { id: "manual-condition", name: "condition", type: "text", value: "" },
];

const runStatusTone = (status: PropertyRunStatus): "danger" | "neutral" | "success" | "warning" => {
    switch (status) {
        case "success":
            return "success";
        case "failed":
            return "danger";
        case "running":
            return "warning";
        case "pending":
        default:
            return "neutral";
    }
};

const scheduleStatusLabel = (
    scheduleIntervalSeconds: number | undefined,
    latestRun: { readonly attempt_count: number; readonly max_attempts: number; readonly status: PropertyRunStatus; } | undefined,
): string => {
    if (latestRun?.status === "running") {
        return "Running";
    }

    if (latestRun?.status === "failed") {
        return latestRun.attempt_count < latestRun.max_attempts
            ? `Failed · retry ${latestRun.attempt_count + 1} of ${latestRun.max_attempts} pending`
            : "Failed";
    }

    if (scheduleIntervalSeconds !== undefined && scheduleIntervalSeconds > 0) {
        return "Scheduled";
    }

    return "Manual only";
};

const metadataToDraft = (property: { readonly metadata?: PropertyMetadata; readonly pause_reason?: string; readonly paused?: boolean; }): PropertyMetadataDraft => {
    const metadata = property.metadata;
    return {
        acquisitionNotes: metadata?.acquisition_notes ?? "",
        attachmentsText: formatReferenceLines(metadata?.attachments),
        businessStage: metadata?.business_stage ?? "",
        dealThesis: metadata?.deal_thesis ?? "",
        expectedRent: metadata?.expected_rent !== undefined ? `${metadata.expected_rent}` : "",
        expectedYieldPercent: metadata?.expected_yield_bps !== undefined ? `${metadata.expected_yield_bps / BASIS_POINTS_PER_PERCENT}` : "",
        externalReferencesText: formatReferenceLines(metadata?.external_references),
        pauseReason: property.pause_reason ?? "",
        paused: property.paused ?? false,
        priorityLevel: metadata?.priority_level ?? "",
        targetPrice: metadata?.target_price !== undefined ? `${metadata.target_price}` : "",
    };
};

const formatReferenceLines = (items: readonly (PropertyReference | PropertyAttachment)[] | undefined): string => {
    return (items ?? []).map((item) => `${item.label}|${"value" in item ? item.value : item.url}`).join("\n");
};

const parseReferenceLines = (value: string): PropertyReference[] => {
    return value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => {
            const [label = "", rawValue = ""] = line.split("|");
            return { label: label.trim(), value: rawValue.trim() };
        })
        .filter((item) => item.label !== "" && item.value !== "");
};

const parseAttachmentLines = (value: string): PropertyAttachment[] => {
    return value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => {
            const [label = "", rawURL = ""] = line.split("|");
            return { label: label.trim(), url: rawURL.trim() };
        })
        .filter((item) => item.label !== "" && item.url !== "");
};

const parseOptionalNumber = (value: string): number | undefined => {
    if (value.trim() === "") {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const validateOptionalPropertyURL = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (trimmed === "") {
        return undefined;
    }

    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? undefined
            : "Enter a valid http:// or https:// URL.";
    } catch {
        return "Enter a valid http:// or https:// URL.";
    }
};

const validateCreateURL = (url: string, manualEntryMode: boolean): string | undefined => {
    if (manualEntryMode) {
        return undefined;
    }

    return url.trim() === ""
        ? "URL is required unless this is a manual exception."
        : validateOptionalPropertyURL(url);
};

const getCreateURLHint = (
    url: string,
    autofillStatus: "error" | "idle" | "loading" | "success",
    autofillMessage: string,
    hasTemplate: boolean,
    manualEntry: boolean,
): string => {
    if (manualEntry) {
        return "Manual entry is an exception path. Add a URL later when one becomes available.";
    }

    if (url.trim() === "") {
        return hasTemplate
            ? "Required for URL-based acquisition. Nido will use this URL to inherit template-backed fields and future price tracking."
            : "Required for URL-based acquisition. Add a template if you want fields to auto-load, or continue without one.";
    }

    if (autofillStatus === "loading") {
        return "Checking the URL for available details...";
    }

    if (autofillMessage !== "") {
        return autofillMessage;
    }

    return hasTemplate
        ? "Nido will use this URL as the primary source for future runs and template-backed extraction."
        : "Nido will use this URL as the primary source. You can add a template later if you want reusable extraction fields.";
};

const getSavePropertyLabel = (isCreateMode: boolean, isPending: boolean): string => {
    if (isPending) {
        return "Saving...";
    }

    return isCreateMode ? "Create Property" : "Save changes";
};

const createManualAttributeDraft = (): ManualAttributeDraft => ({
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    type: "text",
    value: "",
});

const normalizeManualAttributeName = (value: string): string => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

const formatFieldName = (value: string): string => value
    .split(/[_\s-]+/)
    .filter((part) => part !== "")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatMappingState = (value: "matched" | "overridden" | "stale" | "unmatched"): string => {
    switch (value) {
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

const buildManualAttributePayload = (rows: readonly ManualAttributeDraft[]): PropertyManualData | undefined => {
    const payload: PropertyManualData = {};
    for (const row of rows) {
        const key = normalizeManualAttributeName(row.name);
        const value = row.value.trim();
        if (key === "" || value === "") {
            continue;
        }

        if (row.type === "numeric") {
            const parsed = Number(value);
            payload[key] = Number.isFinite(parsed) ? parsed : value;
            continue;
        }

        payload[key] = value;
    }

    return Object.keys(payload).length > 0 ? payload : undefined;
};

const manualAttributeRowsFromValues = (values: Record<string, string>): ManualAttributeDraft[] => {
    const rows = Object.entries(values).map(([name, value], index) => ({
        id: `manual-existing-${index}-${name}`,
        name,
        type: parseAttributeNumber(value) !== undefined ? "numeric" as const : "text" as const,
        value,
    }));

    return rows.length > 0 ? rows : DEFAULT_MANUAL_ATTRIBUTES.map((row) => ({ ...row }));
};

const inferTrackingMode = (property: { readonly metadata?: PropertyMetadata; readonly source_id?: string; readonly url?: string; } | undefined): PropertyTrackingMode => {
    if (property?.metadata?.tracking_mode === "manual" || property?.metadata?.tracking_mode === "automatic") {
        return property.metadata.tracking_mode;
    }

    return (property?.url !== undefined && property.url.trim() !== "") || (property?.source_id !== undefined && property.source_id.trim() !== "")
        ? "automatic"
        : "manual";
};


const parseAttributeNumber = (value: string | undefined): number | undefined => {
    if (value === undefined) {
        return undefined;
    }

    const parsed = Number(value.replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
    return Number.isFinite(parsed) ? parsed : undefined;
};

const formatEuro = (value: number): string => `${Math.round(value).toLocaleString("en")} €`;

type PriceMetricTone = "danger" | "neutral" | "success";

interface PriceMetricCardProps {
    readonly emphasis?: boolean;
    readonly label: string;
    readonly meta?: string;
    readonly tone?: PriceMetricTone;
    readonly value: string;
}

const formatSignedEuro = (value: number | undefined): string => {
    if (value === undefined) {
        return "—";
    }

    return `${value > 0 ? "+" : ""}${formatEuro(value)}`;
};

const formatSignedPercent = (value: number | undefined): string => {
    if (value === undefined) {
        return "—";
    }

    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
};

const formatPriceClassification = (value: ReturnType<typeof buildPriceIntelligence>["classification"]): string => {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
};

const getPriceMetricTone = (value: number | undefined): PriceMetricTone => {
    if (value === undefined) {
        return "neutral";
    }

    return value > 0 ? "danger" : "success";
};

const getPriceClassificationTone = (value: ReturnType<typeof buildPriceIntelligence>["classification"]): "danger" | "success" | "warning" => {
    switch (value) {
        case "cheap":
            return "success";
        case "expensive":
            return "danger";
        case "fair":
        default:
            return "warning";
    }
};

const getFreshnessTone = (value: string | undefined): "danger" | "neutral" | "success" | "warning" => {
    switch (value) {
        case "fresh":
            return "success";
        case "aging":
            return "warning";
        case "stale":
            return "danger";
        case "unknown":
        default:
            return "neutral";
    }
};

const isExternalHTTPURL = (value: string): boolean => validateOptionalPropertyURL(value) === undefined;

const PriceMetricCard = ({ emphasis = false, label, meta, tone = "neutral", value }: PriceMetricCardProps): JSX.Element => {
    return (
        <article className={emphasis ? "property-price-metric property-price-metric--featured" : "property-price-metric"}>
            <span className={"property-price-metric__label"}>{label}</span>
            <strong className={`property-price-metric__value property-price-metric__value--${tone}`}>
                {value}
            </strong>
            {meta !== undefined && meta !== "" ? <span className={"property-price-metric__meta"}>{meta}</span> : null}
        </article>
    );
};

const buildPropertyAttributes = (values: Record<string, string>): { pricePerSquareMeter?: string; rooms?: string; surfaceArea?: string; totalPrice?: string; } => {
    const price = parseAttributeNumber(values.price ?? values.total_price);
    const area = parseAttributeNumber(values.area_m2 ?? values.surface_area ?? values.surface);
    const rooms = values.rooms ?? values.bedrooms;

    return {
        pricePerSquareMeter: price !== undefined && area !== undefined && area > 0 ? `${Math.round(price / area).toLocaleString("en")} €/m²` : undefined,
        rooms,
        surfaceArea: area !== undefined ? `${area.toLocaleString("en")} m²` : undefined,
        totalPrice: price !== undefined ? formatEuro(price) : undefined,
    };
};

const createPriceSelectorDrafts = (): SelectorFieldDraft[] => createDefaultSelectorDrafts().filter((field) => field.name === "price");

type PropertySectionId = "configuration" | "insights" | "notes-decisions" | "overview";

const PROPERTY_SECTIONS: { readonly id: PropertySectionId; readonly label: string; }[] = [
    { id: "overview", label: "Overview" },
    { id: "insights", label: "Insights" },
    { id: "notes-decisions", label: "Notes & Decisions" },
    { id: "configuration", label: "Configuration" },
];

const toTemplateFieldDraft = (field: ReturnType<typeof parseSelectorConfigJson>[number]): SelectorFieldDraft => ({
    ...selectorToDraft(field),
    propertyOverride: false,
    templateFieldName: field.name,
    templateSignature: buildFieldSelectorSignature(field),
});

const stripTemplateFieldMetadata = (field: SelectorFieldDraft): SelectorFieldDraft => ({
    ...field,
    propertyOverride: false,
    templateFieldName: undefined,
    templateSignature: undefined,
});

const isConfiguredFieldDraft = (field: SelectorFieldDraft): boolean => {
    return field.name.trim() !== "" && (field.selectorValue.trim() !== "" || field.fallbackSelectorsRaw.trim() !== "");
};

export const PropertyDetailPage = (): JSX.Element => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { pushToast } = useToast();
    const { propertyId } = useParams<{ propertyId: string; }>();
    const isCreateMode = propertyId === undefined || propertyId === "new";
    const resolvedId = isCreateMode ? "" : propertyId;

    const workspaceSettings = useMemo(() => readWorkspaceSettings(), []);
    const [url, setUrl] = useState("");
    const [label, setLabel] = useState("");
    const [sourceId, setSourceId] = useState(() => workspaceSettings.operations.default_source_id);
    const [scheduleIntervalValue, setScheduleIntervalValue] = useState(() => workspaceSettings.operations.default_schedule_interval_value);
    const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState<DurationUnit>(() => workspaceSettings.operations.default_schedule_interval_unit);
    const [retryMaxAttempts, setRetryMaxAttempts] = useState(() => workspaceSettings.operations.default_retry_max_attempts);
    const [retryBackoffMillis, setRetryBackoffMillis] = useState(() => workspaceSettings.operations.default_retry_backoff_millis);
    const [fieldRows, setFieldRows] = useState<SelectorFieldDraft[]>(() => isCreateMode ? createPriceSelectorDrafts() : createDefaultSelectorDrafts());
    const [previewMap, setPreviewMap] = useState<Map<string, PropertyPreviewFieldResult>>(new Map());
    const [previewFailures, setPreviewFailures] = useState<string[]>([]);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [createAlertOpen, setCreateAlertOpen] = useState(false);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
    const [chartOpen, setChartOpen] = useState(false);
    const [snapshotConfigFilter, setSnapshotConfigFilter] = useState<number>(0);
    const [compareLeftVersion, setCompareLeftVersion] = useState<number>(0);
    const [compareRightVersion, setCompareRightVersion] = useState<number>(0);
    const [rollbackTargetVersion, setRollbackTargetVersion] = useState<number | null>(null);
    const [metadataDraft, setMetadataDraft] = useState<PropertyMetadataDraft>(EMPTY_METADATA_DRAFT);
    const [manualAttributeRows, setManualAttributeRows] = useState<ManualAttributeDraft[]>(() => DEFAULT_MANUAL_ATTRIBUTES.map((row) => ({ ...row })));
    const [additionalFieldsOpen, setAdditionalFieldsOpen] = useState(false);
    const [trackingMode, setTrackingMode] = useState<PropertyTrackingMode>("automatic");
    const [autofillStatus, setAutofillStatus] = useState<"error" | "idle" | "loading" | "success">("idle");
    const [autofillMessage, setAutofillMessage] = useState("");
    const [activeSection, setActiveSection] = useState<PropertySectionId>("overview");
    const [detachmentAlertDismissed, setDetachmentAlertDismissed] = useState(false);
    const previousDetachedRef = useRef(false);
    const previousTemplateIdRef = useRef("");

    const propertyQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => getProperty(resolvedId),
        queryKey: propertyKeys.detail(resolvedId),
    });
    const configQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => getPropertyConfig(resolvedId),
        queryKey: propertyKeys.config(resolvedId),
    });
    const configVersionsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertyConfigVersions(resolvedId),
        queryKey: propertyKeys.configVersions(resolvedId),
    });
    const snapshotsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertySnapshots(resolvedId),
        queryKey: propertyKeys.snapshots(resolvedId),
    });
    const propertyTagsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertyTags(resolvedId),
        queryKey: tagKeys.propertyTags(resolvedId),
    });
    const propertyRunsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertyRuns(resolvedId, 10),
        queryKey: propertyKeys.runs(resolvedId),
        refetchInterval: PROPERTY_RUNS_REFETCH_INTERVAL_MS,
    });
    const fieldDefinitionsQuery = useQuery({
        queryFn: listFields,
        queryKey: fieldKeys.list(),
    });
    const sourcesQuery = useQuery({
        queryFn: listSources,
        queryKey: sourceKeys.list(),
    });
    const bookmarksQuery = useQuery({
        queryFn: listBookmarks,
        queryKey: bookmarkKeys.all(),
    });
    const alertsQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: listAlertRules,
        queryKey: alertRuleKeys.all(),
    });
    const summaryQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => getPropertySummary(resolvedId),
        queryKey: propertyKeys.summary(resolvedId),
    });
    const summariesQuery = useQuery({
        enabled: !isCreateMode,
        queryFn: () => listPropertySummaries(),
        queryKey: propertyKeys.summaries(),
    });

    useEffect(() => {
        if (propertyQuery.data !== undefined) {
            setUrl(propertyQuery.data.url);
            setLabel(propertyQuery.data.label);
            setSourceId(propertyQuery.data.source_id ?? "");
            const scheduleDraft = durationDraftFromSeconds(propertyQuery.data.schedule_interval_seconds);
            setScheduleIntervalValue(scheduleDraft.value);
            setScheduleIntervalUnit(scheduleDraft.unit);
            setRetryMaxAttempts(propertyQuery.data.retry_max_attempts ?? 1);
            setRetryBackoffMillis(propertyQuery.data.retry_backoff_millis ?? 500);
            setMetadataDraft(metadataToDraft(propertyQuery.data));
            setTrackingMode(inferTrackingMode(propertyQuery.data));
        }
    }, [propertyQuery.data]);

    useEffect(() => {
        setActiveSection("overview");
    }, [resolvedId]);

    useEffect(() => {
        if (!isCreateMode || url.trim() !== "" || label.trim() !== "") {
            return;
        }

        setSourceId(workspaceSettings.operations.default_source_id);
        setScheduleIntervalValue(workspaceSettings.operations.default_schedule_interval_value);
        setScheduleIntervalUnit(workspaceSettings.operations.default_schedule_interval_unit);
        setRetryMaxAttempts(workspaceSettings.operations.default_retry_max_attempts);
        setRetryBackoffMillis(workspaceSettings.operations.default_retry_backoff_millis);
    }, [isCreateMode, label, url, workspaceSettings]);

    useEffect(() => {
        if (configQuery.data?.fields !== undefined && configQuery.data.fields.length > 0) {
            setFieldRows(configQuery.data.fields.map(selectorToDraft));
        }
    }, [configQuery.data]);

    const manualEntryMode = trackingMode === "manual";
    const scheduleIntervalSeconds = durationDraftToSeconds(scheduleIntervalValue, scheduleIntervalUnit);
    const scheduleIntervalError = scheduleIntervalSeconds === null ? "Choose a run interval greater than zero." : undefined;
    const retryBackoffError = retryBackoffMillis < MIN_RETRY_BACKOFF_MS
        ? `Retry interval must be at least ${MIN_RETRY_BACKOFF_MS}ms.`
        : undefined;
    const effectiveScheduleIntervalSeconds = scheduleIntervalSeconds ?? 0;
    const effectiveRetryBackoffMillis = Math.max(retryBackoffMillis, MIN_RETRY_BACKOFF_MS);
    const effectiveRetryMaxAttempts = Math.max(retryMaxAttempts, 1);
    const urlError = validateCreateURL(url, manualEntryMode);
    const propertySaveError = isCreateMode || manualEntryMode ? undefined : scheduleIntervalError ?? retryBackoffError;
    const selectedSource = useMemo(
        () => (sourcesQuery.data ?? []).find((source) => source.id === sourceId),
        [sourceId, sourcesQuery.data],
    );
    const sourceTemplateFields = useMemo(
        () => parseSelectorConfigJson(selectedSource?.config_json),
        [selectedSource?.config_json],
    );
    const templatePrefillFields = useMemo(
        () => sourceTemplateFields.filter((field) => field.field_role !== "tracked").map((field) => formatFieldName(field.name)),
        [sourceTemplateFields],
    );
    const templateTrackedFields = useMemo(
        () => sourceTemplateFields.filter((field) => field.field_role === "tracked" || field.name === "price").map((field) => formatFieldName(field.name)),
        [sourceTemplateFields],
    );
    const noTemplateSelected = sourceId.trim() === "";
    const createURLHint = getCreateURLHint(url, autofillStatus, autofillMessage, sourceId.trim() !== "", manualEntryMode);
    const templateFieldsByName = useMemo(
        () => new Map(sourceTemplateFields.map((field) => [field.name, field])),
        [sourceTemplateFields],
    );
    const fieldMetadataById = useMemo<Record<string, { currentValue?: string; origin: "manual" | "template"; reason: string; sourceLabel: string; status: "matched" | "overridden" | "stale" | "unmatched"; }>>(() => {
        return Object.fromEntries(fieldRows.map((field) => {
            const templateField = field.templateFieldName === undefined ? undefined : templateFieldsByName.get(field.templateFieldName);
            const mappingState = getFieldMappingState(field, templateField, selectedSource?.name ?? "");
            return [field.id, {
                origin: mappingState.state === "unmatched" ? "manual" : "template",
                reason: mappingState.reason,
                sourceLabel: mappingState.sourceLabel,
                status: mappingState.state,
            }] as const;
        }));
    }, [fieldRows, selectedSource?.name, templateFieldsByName]);
    const priceHistoryPoints = useMemo(() => buildPriceHistoryPoints(snapshotsQuery.data ?? []), [snapshotsQuery.data]);
    const missingTemplateField = useMemo(() => {
        if (sourceId.trim() === "" || sourceTemplateFields.length === 0) {
            return false;
        }

        return sourceTemplateFields.some((field) => {
            return !fieldRows.some((row) => row.templateFieldName === field.name);
        });
    }, [fieldRows, sourceId, sourceTemplateFields]);
    const isTemplateDetached = useMemo(() => {
        if (sourceId.trim() === "" || sourceTemplateFields.length === 0) {
            return false;
        }

        const metadataValues = Object.values(fieldMetadataById);
        const hasMissingTemplateField = missingTemplateField;
        const hasModifiedTemplateField = metadataValues.some((metadata) => metadata.origin === "template" && (metadata.status === "overridden" || metadata.status === "stale"));
        const hasManualFields = metadataValues.some((metadata) => metadata.origin === "manual");

        return hasMissingTemplateField || hasModifiedTemplateField || hasManualFields;
    }, [fieldMetadataById, missingTemplateField, sourceId, sourceTemplateFields.length]);
    const unmatchedTemplateFields = useMemo(() => {
        const mappedTemplateNames = new Set(fieldRows.map((field) => field.templateFieldName).filter((name): name is string => name !== undefined && name !== ""));
        return sourceTemplateFields.filter((field) => !mappedTemplateNames.has(field.name));
    }, [fieldRows, sourceTemplateFields]);

    useEffect(() => {
        if (isCreateMode) {
            if (manualEntryMode) {
                previousTemplateIdRef.current = "";
                return;
            }

            const trimmedSourceId = sourceId.trim();
            const previousTemplateId = previousTemplateIdRef.current;
            if (trimmedSourceId === "") {
                if (previousTemplateId !== "") {
                    setFieldRows((currentFields) => currentFields.map(stripTemplateFieldMetadata));
                }

                previousTemplateIdRef.current = "";
                return;
            }

            if (trimmedSourceId !== previousTemplateId) {
                previousTemplateIdRef.current = trimmedSourceId;
                if (sourceTemplateFields.length > 0) {
                    setFieldRows(sourceTemplateFields.map(toTemplateFieldDraft));
                    setAdditionalFieldsOpen(true);
                }
            }

            return;
        }

        if (sourceTemplateFields.length === 0) {
            return;
        }

        setFieldRows((currentFields) => {
            let changed = false;
            const nextFields = currentFields.map((field) => {
                if (field.templateFieldName !== undefined && field.templateSignature !== undefined) {
                    return field;
                }

                const templateField = templateFieldsByName.get(field.name.trim());
                if (templateField === undefined) {
                    return field;
                }

                changed = true;
                return {
                    ...field,
                    templateFieldName: templateField.name,
                    templateSignature: buildFieldSelectorSignature(templateField),
                };
            });

            return changed ? nextFields : currentFields;
        });
    }, [isCreateMode, manualEntryMode, sourceId, sourceTemplateFields, templateFieldsByName]);

    const revertTemplateField = (fieldId: string): void => {
        setFieldRows((currentFields) => currentFields.map((field) => {
            const templateFieldName = field.templateFieldName;
            if (field.id !== fieldId || templateFieldName === undefined) {
                return field;
            }

            const templateField = templateFieldsByName.get(templateFieldName);
            if (templateField === undefined) {
                return field;
            }

            return { ...toTemplateFieldDraft(templateField), id: field.id };
        }));
        pushToast("Mapping reverted to the current template field.", "success");
    };

    const overrideTemplateField = (fieldId: string): void => {
        setFieldRows((currentFields) => currentFields.map((field) => {
            if (field.id !== fieldId) {
                return field;
            }

            const templateField = field.templateFieldName === undefined ? undefined : templateFieldsByName.get(field.templateFieldName);
            return {
                ...field,
                propertyOverride: true,
                templateSignature: templateField === undefined ? field.templateSignature : buildFieldSelectorSignature(templateField),
            };
        }));
        pushToast("Property override enabled. Revert to template when you want updates again.", "success");
    };

    const addTemplateMapping = (fieldName: string): void => {
        const templateField = templateFieldsByName.get(fieldName);
        if (templateField === undefined) {
            pushToast(`Could not create mapping for ${fieldName}: source field is missing.`, "error");
            return;
        }

        setFieldRows((currentFields) => [...currentFields, toTemplateFieldDraft(templateField)]);
        setAdditionalFieldsOpen(true);
        pushToast(`Mapping created for ${formatFieldName(fieldName)}. Save configuration to persist it.`, "success");
    };

    useEffect(() => {
        if (isTemplateDetached && !previousDetachedRef.current) {
            setDetachmentAlertDismissed(false);
        }

        if (!isTemplateDetached) {
            setDetachmentAlertDismissed(false);
        }

        previousDetachedRef.current = isTemplateDetached;
    }, [isTemplateDetached]);

    const handlePropertySave = (): void => {
        if (savePropertyMutation.isPending || propertySaveError !== undefined || urlError !== undefined) {
            return;
        }

        savePropertyMutation.mutate();
    };

    const handlePropertySubmit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        handlePropertySave();
    };

    useEffect(() => {
        if (!isCreateMode || manualEntryMode) {
            return undefined;
        }

        const trimmedURL = url.trim();
        if (trimmedURL === "") {
            setAutofillStatus("idle");
            setAutofillMessage("");
            return undefined;
        }

        if (urlError !== undefined) {
            setAutofillStatus("error");
            setAutofillMessage("Fix the URL to enable optional autofill.");
            return undefined;
        }

        if (sourceTemplateFields.length === 0) {
            setAutofillStatus("idle");
            setAutofillMessage(sourceId.trim() === ""
                ? "URL will be saved as a reference. Add details to link a source template for autofill."
                : "This source template can store the URL, but it does not expose autofill fields yet.");
            return undefined;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setAutofillStatus("loading");
            setAutofillMessage("Checking the URL for available details...");
            try {
                const result = await previewExtraction({
                    fields: sourceTemplateFields,
                    url: trimmedURL,
                });
                if (cancelled) {
                    return;
                }

                setAutofillStatus(result.success ? "success" : "error");
                const prefillFieldNames = new Set(sourceTemplateFields
                    .filter((field) => field.field_role !== "tracked")
                    .map((field) => field.name));
                const hasPrefillValues = result.fields.some((field) => prefillFieldNames.has(field.name) && field.success);
                setAutofillMessage(result.success
                    ? hasPrefillValues ? "URL checked. Property facts are ready to prefill from this template." : "URL checked. No property facts were available to prefill from this template."
                    : "Could not check the URL. You can still create the property and capture the first price from a later snapshot.");
            } catch {
                if (cancelled) {
                    return;
                }

                setAutofillStatus("error");
                setAutofillMessage("Could not check the URL. You can still create the property and capture the first price from a later snapshot.");
            }
        }, AUTOFILL_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [isCreateMode, manualEntryMode, sourceId, sourceTemplateFields, url, urlError]);

    const savePropertyMutation = useMutation({
        mutationFn: async () => {
            const expectedYield = parseOptionalNumber(metadataDraft.expectedYieldPercent);
            const manualData = manualEntryMode ? buildManualAttributePayload(manualAttributeRows) : undefined;
            const payload = {
                label,
                manual_data: manualData,
                metadata: {
                    acquisition_notes: metadataDraft.acquisitionNotes.trim() !== "" ? metadataDraft.acquisitionNotes.trim() : undefined,
                    attachments: parseAttachmentLines(metadataDraft.attachmentsText),
                    business_stage: metadataDraft.businessStage.trim() !== "" ? metadataDraft.businessStage.trim() : undefined,
                    deal_thesis: metadataDraft.dealThesis.trim() !== "" ? metadataDraft.dealThesis.trim() : undefined,
                    expected_rent: parseOptionalNumber(metadataDraft.expectedRent),
                    expected_yield_bps: expectedYield !== undefined ? Math.round(expectedYield * BASIS_POINTS_PER_PERCENT) : undefined,
                    external_references: parseReferenceLines(metadataDraft.externalReferencesText),
                    priority_level: metadataDraft.priorityLevel.trim() !== "" ? metadataDraft.priorityLevel.trim() : undefined,
                    target_price: parseOptionalNumber(metadataDraft.targetPrice),
                    tracking_mode: trackingMode,
                },
                pause_reason: metadataDraft.pauseReason.trim() !== "" ? metadataDraft.pauseReason.trim() : undefined,
                paused: metadataDraft.paused,
                retry_backoff_millis: effectiveRetryBackoffMillis,
                retry_max_attempts: effectiveRetryMaxAttempts,
                schedule_interval_seconds: manualEntryMode ? 0 : effectiveScheduleIntervalSeconds,
                source_id: !manualEntryMode && sourceId.trim() !== "" ? sourceId.trim() : undefined,
                url: manualEntryMode ? "" : url,
            };

            if (isCreateMode) {
                return createProperty(payload);
            }

            return updateProperty(resolvedId, payload);
        },
        async onSuccess(data) {
            if (isCreateMode) {
                const configuredFields = manualEntryMode ? [] : fieldRows
                    .filter(isConfiguredFieldDraft)
                    .map(draftToSelector);
                if (configuredFields.length > 0) {
                    try {
                        await upsertPropertyConfig(data.id, configuredFields);
                    } catch {
                        pushToast("Property created, but the initial config could not be saved. Open the property to review the selectors.", "error");
                    }
                }
            }

            queryClient.setQueryData(propertyKeys.detail(data.id), data);
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: propertyKeys.list() }),
                queryClient.invalidateQueries({ queryKey: propertyKeys.summaries() }),
                queryClient.invalidateQueries({ queryKey: propertyKeys.configVersions(data.id) }),
            ]);
            pushToast(isCreateMode ? "Property created." : "Property updated.", "success");
            if (isCreateMode) {
                void navigate("/properties", { replace: true });
                return;
            }

            void Promise.all([
                queryClient.invalidateQueries({ queryKey: propertyKeys.detail(resolvedId) }),
                queryClient.invalidateQueries({ queryKey: propertyKeys.summary(resolvedId) }),
            ]);
        },
    });
    const saveConfigMutation = useMutation({
        mutationFn: () => upsertPropertyConfig(
            resolvedId,
            fieldRows
                .filter((row) => row.name.trim() !== "")
                .map(draftToSelector),
        ),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.config(resolvedId) });
            pushToast("Configuration saved.", "success");
        },
    });
    const rollbackConfigMutation = useMutation({
        mutationFn: (version: number) => rollbackPropertyConfig(resolvedId, version),
        onError() {
            pushToast("Could not roll back configuration.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.config(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.configVersions(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.snapshots(resolvedId) });
            setRollbackTargetVersion(null);
            pushToast("Configuration rolled back.", "success");
        },
    });
    const previewMutation = useMutation({
        mutationFn: () => previewExtraction({
            fields: fieldRows
                .map(draftToSelector)
                .filter((field) => field.name !== ""),
            url,
        }),
        onSuccess(data) {
            setPreviewMap(buildPreviewFieldMap(data.fields));
            setPreviewFailures(data.failures ?? []);
        },
        onError() {
            setPreviewMap(new Map());
            setPreviewFailures(["Extraction preview failed. Check the URL and selectors."]);
        },
    });
    const ingestMutation = useMutation({
        mutationFn: () => ingestProperty(resolvedId),
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.detail(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.snapshots(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: runKeys.all() });
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
            pushToast("Run started.", "success");
        },
    });
    const bookmarkMutation = useMutation({
        mutationFn: async () => {
            if (resolvedId === "") {
                return;
            }

            const bookmarkedIds = new Set((bookmarksQuery.data ?? []).map((item) => item.property_id));
            if (bookmarkedIds.has(resolvedId)) {
                await deleteBookmark(resolvedId);
                return;
            }

            await createBookmark(resolvedId);
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteProperty,
        onError() {
            pushToast("Could not delete property.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            void queryClient.invalidateQueries({ queryKey: bookmarkKeys.all() });
            pushToast("Property deleted.", "success");
            void navigate("/properties");
        },
    });
    const updateTagsMutation = useMutation({
        mutationFn: (tagIds: string[]) => setPropertyTags(resolvedId, tagIds),
        onError() {
            pushToast("Could not update tags.", "error");
        },
        onSuccess() {
            void queryClient.invalidateQueries({ queryKey: tagKeys.propertyTags(resolvedId) });
            void queryClient.invalidateQueries({ queryKey: propertyKeys.list() });
            setTagsOpen(false);
            pushToast("Tags updated.", "success");
        },
    });
    const isPropertySaveDisabled = savePropertyMutation.isPending || propertySaveError !== undefined || urlError !== undefined;

    const latestSnapshot = snapshotsQuery.data?.[0];
    const latestAutomationRun = propertyRunsQuery.data?.[0];
    const propertyAlerts = useMemo(() => {
        return (alertsQuery.data ?? []).filter((rule) => rule.property_id === resolvedId);
    }, [alertsQuery.data, resolvedId]);
    const isBookmarked = (bookmarksQuery.data ?? []).some((item) => item.property_id === resolvedId);
    const validationMessages = useMemo(() => validateSelectorDrafts(fieldRows), [fieldRows]);
    const extractedValueRows = useMemo(() => {
        const values = { ...latestSnapshot?.values ?? {} };
        const configuredFields = fieldRows.map((field) => ({ fallback: field.defaultValue, name: field.name, useFallback: field.useDefaultWhenMissing }));
        for (const field of configuredFields) {
            if (field.useFallback && field.name.trim() !== "" && values[field.name] === undefined && field.fallback.trim() !== "") {
                values[field.name] = field.fallback;
            }
        }

        for (const definition of fieldDefinitionsQuery.data ?? []) {
            if (definition.use_default_when_missing && definition.default_value !== undefined && definition.default_value !== "" && values[definition.name] === undefined) {
                values[definition.name] = definition.default_value;
            }
        }

        return Object.entries(values).map(([field, value]) => {
            const draft = fieldRows.find((row) => row.name.trim() === field);
            const metadata = draft === undefined ? undefined : fieldMetadataById[draft.id];
            return {
                field,
                source: metadata?.sourceLabel ?? "Latest snapshot (no mapping)",
                state: metadata?.status ?? "unmatched" as const,
                value,
            };
        });
    }, [fieldDefinitionsQuery.data, fieldMetadataById, fieldRows, latestSnapshot?.values]);
    const latestValues = useMemo(() => Object.fromEntries(extractedValueRows.map((item) => [item.field, item.value])), [extractedValueRows]);
    useEffect(() => {
        if (isCreateMode) {
            return;
        }

        const sourceValues = Object.keys(latestValues).length > 0 ? latestValues : summaryQuery.data?.current_values;
        if (sourceValues === undefined || Object.keys(sourceValues).length === 0) {
            return;
        }

        setManualAttributeRows(manualAttributeRowsFromValues(sourceValues));
    }, [isCreateMode, latestValues, summaryQuery.data?.current_values]);
    const attributes = useMemo(() => buildPropertyAttributes(latestValues), [latestValues]);
    const propertyFactRows = useMemo(() => {
        return Object.entries(latestValues)
            .filter(([field]) => field !== "price" && field !== "total_price")
            .map(([field, value]) => ({ field: formatFieldName(field), value }));
    }, [latestValues]);
    const primarySignals = useMemo(() => summaryQuery.data?.signals.filter((signal) => signal.group !== "listing_facts") ?? [], [summaryQuery.data?.signals]);
    const listingFactSignals = useMemo(() => summaryQuery.data?.signals.filter((signal) => signal.group === "listing_facts") ?? [], [summaryQuery.data?.signals]);
    const recentRuns = useMemo(() => {
        const snapshots = snapshotsQuery.data ?? [];
        if (snapshotConfigFilter <= 0) {
            return snapshots;
        }

        return snapshots.filter((snapshot) => snapshot.config_version === snapshotConfigFilter);
    }, [snapshotConfigFilter, snapshotsQuery.data]);
    const configVersions = configVersionsQuery.data ?? [];
    const oldestConfig = configVersions[configVersions.length - 1] ?? configVersions[0];
    const newestConfig = configVersions[0];
    const selectedLeftConfig = configVersions.find((config) => config.version === compareLeftVersion)
        ?? oldestConfig;
    const selectedRightConfig = configVersions.find((config) => config.version === compareRightVersion)
        ?? newestConfig;
    const configDiff = diffPropertyConfigs(selectedLeftConfig, selectedRightConfig);
    const persistedScheduleSummary = useMemo(() => {
        if (propertyQuery.data?.schedule_interval_seconds === undefined || propertyQuery.data.schedule_interval_seconds <= 0) {
            return "Manual only";
        }

        return `Runs every ${formatDurationFromSeconds(propertyQuery.data.schedule_interval_seconds).toLowerCase()}`;
    }, [propertyQuery.data?.schedule_interval_seconds]);
    const persistedRetrySummary = useMemo(() => {
        return retryMaxAttempts <= 1
            ? "Retries are disabled for failed runs."
            : `Retry on failure up to ${retryMaxAttempts} attempts with ${retryBackoffMillis}ms between attempts.`;
    }, [retryBackoffMillis, retryMaxAttempts]);
    const automationStatus = useMemo(() => {
        return scheduleStatusLabel(propertyQuery.data?.schedule_interval_seconds, latestAutomationRun);
    }, [latestAutomationRun, propertyQuery.data?.schedule_interval_seconds]);
    const automationStatusTone: "danger" | "neutral" | "success" | "warning" = latestAutomationRun?.status === "running"
        ? "warning"
        : latestAutomationRun?.status === "failed"
            ? "danger"
            : propertyQuery.data?.schedule_interval_seconds !== undefined && propertyQuery.data.schedule_interval_seconds > 0
                ? "success"
                : "neutral";
    const pricingInsight = useMemo(() => {
        return summaryQuery.data !== undefined
            ? buildPriceIntelligence(summaryQuery.data, summariesQuery.data ?? [summaryQuery.data], workspaceSettings)
            : undefined;
    }, [summariesQuery.data, summaryQuery.data, workspaceSettings]);
    const source = sourcesQuery.data?.find((candidate) => candidate.id === propertyQuery.data?.source_id);
    const sourceSummary = source?.name ?? (propertyQuery.data?.url ? "Custom URL" : "Manual tracking");
    const sourceConfigLink = propertyQuery.data?.source_id !== undefined ? `/sources/${propertyQuery.data.source_id}` : undefined;
    const missingFieldCount = extractedValueRows.filter((row) => row.value.trim() === "").length;
    const extractionHealthLabel = latestSnapshot === undefined
        ? "Not available"
        : latestSnapshot.is_valid
            ? missingFieldCount > 0 ? `${missingFieldCount} missing fields` : "Healthy"
            : latestSnapshot.error_message ?? "Extraction error";
    const externalReferences = useMemo(() => parseReferenceLines(metadataDraft.externalReferencesText), [metadataDraft.externalReferencesText]);
    const attachments = useMemo(() => parseAttachmentLines(metadataDraft.attachmentsText), [metadataDraft.attachmentsText]);
    const decisionEntries: DecisionEntry[] = [];
    if (metadataDraft.businessStage.trim() !== "") {
        decisionEntries.push({ label: "Decision status", timestamp: propertyQuery.data?.updated_at, value: formatDecisionStatus(metadataDraft.businessStage) });
    }

    if (metadataDraft.priorityLevel.trim() !== "") {
        decisionEntries.push({ label: "Priority", timestamp: propertyQuery.data?.updated_at, value: metadataDraft.priorityLevel });
    }

    if (summaryQuery.data?.latest_change_summary !== undefined && summaryQuery.data.latest_change_summary !== "") {
        decisionEntries.push({ label: "System signal", timestamp: latestSnapshot?.observed_at, value: summaryQuery.data.latest_change_summary });
    }

    const templateRoleSummary = noTemplateSelected
        ? null
        : (
            <div className={"property-detail-group-grid"}>
                <div className={"property-inline-note"}>
                    <strong>{"Prefill once"}</strong>
                    <span>{templatePrefillFields.length > 0 ? templatePrefillFields.join(", ") : "This template does not prefill any property facts yet. Add fields like location, area, or rooms if you want faster intake."}</span>
                </div>
                <div className={"property-inline-note"}>
                    <strong>{"Monitor on each run"}</strong>
                    <span>{templateTrackedFields.length > 0 ? templateTrackedFields.join(", ") : "This template does not track any live fields yet. Add at least one tracked field, usually price."}</span>
                </div>
            </div>
        );

    const manualAttributeEditor = (
        <div className={"property-section-stack"}>
            <div className={"page-card__title-row"}>
                <strong>{"Manual attribute schema"}</strong>
                <ContextualHelp content={"Define the fields you want to track and enter the values for the next timestamped snapshot."} title={"Manual attribute schema"} />
            </div>
            {manualAttributeRows.map((row) => (
                <FormGrid key={row.id} variant={"two-column"}>
                    <Field label={"Attribute"}>
                        <Input
                            onChange={(event) => {
                                setManualAttributeRows((rows) => rows.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item));
                            }}
                            placeholder={"price, size, condition"}
                            type={"text"}
                            value={row.name}
                        />
                    </Field>
                    <Field label={"Type"}>
                        <Select
                            onChange={(event) => {
                                setManualAttributeRows((rows) => rows.map((item) => item.id === row.id ? { ...item, type: event.target.value as ManualAttributeType } : item));
                            }}
                            value={row.type}
                        >
                            <option value={"numeric"}>{"Numeric"}</option>
                            <option value={"text"}>{"Text"}</option>
                        </Select>
                    </Field>
                    <Field fullWidth label={"Snapshot value"}>
                        <Input
                            onChange={(event) => {
                                setManualAttributeRows((rows) => rows.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item));
                            }}
                            placeholder={row.type === "numeric" ? "250000" : "Needs renovation"}
                            type={row.type === "numeric" ? "number" : "text"}
                            value={row.value}
                        />
                    </Field>
                    <ActionGroup>
                        <Button
                            disabled={manualAttributeRows.length <= 1}
                            onClick={() => { setManualAttributeRows((rows) => rows.filter((item) => item.id !== row.id)); }}
                            type={"button"}
                            variant={"secondary"}
                        >
                            {"Remove attribute"}
                        </Button>
                    </ActionGroup>
                </FormGrid>
            ))}
            <ActionGroup>
                <Button onClick={() => { setManualAttributeRows((rows) => [...rows, createManualAttributeDraft()]); }} type={"button"} variant={"secondary"}>{"Add attribute"}</Button>
            </ActionGroup>
        </div>
    );

    const createContent = (
        <PageStack>
            <PageCard
                description={"Choose a tracking mode first so setup only asks for fields that match how this property will be maintained."}
                title={"Add Property"}
            >
                <FormGrid
                    aria-label={"Create property form"}
                    as={"form"}
                    id={"property-create-form"}
                    onSubmit={handlePropertySubmit}
                    variant={"two-column"}
                >
                    <Field fullWidth hint={"Manual hides every automation field. Automatic derives price from the first successful snapshot."} label={"Tracking mode"}>
                        <div className={"dashboard-grid dashboard-grid--double"}>
                            <label className={"properties-table__column-toggle"}>
                                <input checked={trackingMode === "automatic"} onChange={() => { setTrackingMode("automatic"); }} type={"radio"} />
                                <span>{"Automatic Tracking"}</span>
                            </label>
                            <label className={"properties-table__column-toggle"}>
                                <input checked={trackingMode === "manual"} onChange={() => { setTrackingMode("manual"); setAdditionalFieldsOpen(false); }} type={"radio"} />
                                <span>{"Manual Tracking"}</span>
                            </label>
                        </div>
                    </Field>
                    <Field label={"Label"}>
                        <Input id={"prop-label"} onChange={(event) => { setLabel(event.target.value); }} placeholder={"Optional display name"} type={"text"} value={label} />
                    </Field>
                    {!manualEntryMode ? (
                        <>
                            <Field error={urlError} fullWidth hint={createURLHint} label={"URL"}>
                                <Input
                                    autoFocus
                                    id={"prop-url"}
                                    invalid={urlError !== undefined}
                                    onChange={(event) => { setUrl(event.target.value); }}
                                    placeholder={"https://example.com/property/123"}
                                    type={"url"}
                                    value={url}
                                />
                            </Field>
                            <Field hint={"Optional. Templates can prefill property facts and define what Nido keeps tracking after creation."} label={"Source template"}>
                                <Select id={"prop-source"} onChange={(event) => { setSourceId(event.target.value); }} value={sourceId}>
                                    <option value={""}>{"No template"}</option>
                                    {(sourcesQuery.data ?? []).map((source) => {
                                        return <option key={source.id} value={source.id}>{source.name}</option>;
                                    })}
                                </Select>
                            </Field>
                        </>
                    ) : null}
                </FormGrid>
                {!manualEntryMode && !noTemplateSelected ? (
                    <div className={"property-template-summary"}>
                        <div className={"page-card__title-row"}>
                            <strong>{"What this template will do"}</strong>
                            <ContextualHelp content={"Templates can speed up intake and define what Nido keeps monitoring after the property is created."} title={"What this template will do"} />
                        </div>
                        {templateRoleSummary}
                    </div>
                ) : null}
                {manualEntryMode ? manualAttributeEditor : (
                    <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
                        <div className={"page-card__title-row"}>
                            <Button onClick={() => { setAdditionalFieldsOpen((open) => !open); }} type={"button"} variant={"secondary"}>
                                {additionalFieldsOpen ? "Hide source fields" : "Review source fields"}
                            </Button>
                            <ContextualHelp content={"Price is required now. Other source fields can prefill property facts so you can create the property faster."} title={"Source fields"} />
                        </div>
                    </div>
                )}
                {savePropertyMutation.isError ? <ErrorBanner>{"Could not save property. Check the price, source details, and any optional URL."}</ErrorBanner> : null}
                {!additionalFieldsOpen ? (
                    <ActionGroup>
                        <Button
                            disabled={savePropertyMutation.isPending || urlError !== undefined}
                            form={"property-create-form"}
                            type={"submit"}
                        >
                            {getSavePropertyLabel(true, savePropertyMutation.isPending)}
                        </Button>
                    </ActionGroup>
                ) : null}
            </PageCard>

            {additionalFieldsOpen && !manualEntryMode ? (
                <PageCard description={"Review inherited roles before optional selector editing. Price is the primary tracked signal for acquisition decisions."} title={"Source & extraction configuration"}>
                    {isTemplateDetached && !detachmentAlertDismissed ? (
                        <div className={"property-inline-alert"} role={"status"}>
                            <span className={"property-inline-alert__copy"}>
                                <strong>{"Template link removed for this property."}</strong>
                                <span>{"This field setup no longer matches the selected template, so future template updates will not apply automatically."}</span>
                            </span>
                            <Button onClick={() => { setDetachmentAlertDismissed(true); }} size={"small"} variant={"ghost"}>
                                {"Dismiss"}
                            </Button>
                        </div>
                    ) : null}
                    {unmatchedTemplateFields.length > 0 ? (
                        <div className={"property-unmatched-fields"} role={"status"}>
                            <strong>{"Unmatched template fields"}</strong>
                            <span>{"These source fields are not mapped on this property yet. Create mappings explicitly so they are not silently ignored."}</span>
                            <div className={"property-unmatched-fields__actions"}>
                                {unmatchedTemplateFields.map((field) => (
                                    <Button key={field.name} onClick={() => { addTemplateMapping(field.name); }} size={"small"} variant={"secondary"}>
                                        {`Create mapping: ${formatFieldName(field.name)}`}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    <SelectorBuilder fieldDefinitions={fieldDefinitionsQuery.data} fieldMetadataById={fieldMetadataById} fields={fieldRows} onChange={setFieldRows} onOverrideField={overrideTemplateField} onRevertField={revertTemplateField} previewByFieldName={previewMap} />
                    <ActionGroup>
                        <Button onClick={() => { setFieldRows((rows) => [...rows, createEmptySelectorDraft()]); }} variant={"secondary"}>{"Add field"}</Button>
                        <Button disabled={previewMutation.isPending || url.trim() === "" || validationMessages.length > 0} onClick={() => { previewMutation.mutate(); }} variant={"secondary"}>{previewMutation.isPending ? "Previewing..." : "Preview extraction"}</Button>
                        <Button disabled={isPropertySaveDisabled || validationMessages.length > 0} form={"property-create-form"} type={"submit"}>{savePropertyMutation.isPending ? "Creating..." : "Create Property"}</Button>
                    </ActionGroup>
                    {validationMessages.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {validationMessages.map((message) => <ErrorBanner key={message}>{message}</ErrorBanner>)}
                        </div>
                    ) : null}
                    {previewFailures.length > 0 ? (
                        <div className={"selector-builder__validation-list"}>
                            {previewFailures.map((message) => <ErrorBanner key={message}>{message}</ErrorBanner>)}
                        </div>
                    ) : null}
                </PageCard>
            ) : null}
        </PageStack>
    );

    if (isCreateMode) {
        return createContent;
    }

    return (
        <>
            <PageStack>
                <nav aria-label={"Property sections"} className={"property-detail-nav"}>
                    {PROPERTY_SECTIONS.map((section) => (
                        <button
                            aria-pressed={activeSection === section.id}
                            className={activeSection === section.id ? "property-detail-nav__link property-detail-nav__link--active" : "property-detail-nav__link"}
                            key={section.id}
                            onClick={() => { setActiveSection(section.id); }}
                            type={"button"}
                        >
                            {section.label}
                        </button>
                    ))}
                </nav>
                {activeSection === "overview" ? (
                    <PageCard
                        action={(
                            <ActionGroup>
                                <Button as={Link} to={"/properties"} variant={"secondary"}>{"Back"}</Button>
                                <Button onClick={() => { setExportOpen(true); }} variant={"secondary"}>{"Export"}</Button>
                                <Button onClick={() => { window.open(`/properties/${resolvedId}/print`, "_blank", "noopener"); }} variant={"secondary"}>{"Print / PDF"}</Button>
                            </ActionGroup>
                        )}
                        description={"Immediate read-only summary of the latest known property state."}
                        title={propertyQuery.data?.label !== undefined && propertyQuery.data.label !== "" ? propertyQuery.data.label : propertyQuery.data?.url !== undefined && propertyQuery.data.url !== "" ? propertyQuery.data.url : "Manual property"}
                        titleId={"overview"}
                    >
                        {propertyQuery.isError ? <ErrorBanner>{"Could not load property."}</ErrorBanner> : null}
                        {propertyQuery.data !== undefined ? (
                            <div className={"property-overview-grid"}>
                                <section className={"property-detail-group"}>
                                    <span className={"app-shell__eyebrow"}>{"Core attributes"}</span>
                                    <KeyValueGrid compact>
                                        <KeyValuePair label={"Price (current)"} value={attributes.totalPrice ?? summaryQuery.data?.current_values.price ?? "Not available"} />
                                        <KeyValuePair label={"Location"} value={latestValues.location ?? latestValues.city ?? latestValues.district ?? "Not available"} />
                                        <KeyValuePair label={"Rooms"} value={attributes.rooms ?? latestValues.rooms ?? "Not available"} />
                                        <KeyValuePair label={"Area"} value={attributes.surfaceArea ?? latestValues.area ?? latestValues.area_m2 ?? "Not available"} />
                                        <KeyValuePair label={"Source"} value={sourceSummary} />
                                        <KeyValuePair
                                            label={"Listing URL"}
                                            value={propertyQuery.data.url !== "" ? (
                                                <span className={"status-with-copy"}>
                                                    <a className={"property-detail-anchor"} href={propertyQuery.data.url} rel={"noreferrer"} target={"_blank"}>{"Open listing"}</a>
                                                    <CopyButton label={"Copy property URL"} value={propertyQuery.data.url} />
                                                </span>
                                            ) : "Not available"}
                                        />
                                        {propertyFactRows.slice(0, OVERVIEW_ATTRIBUTE_PREVIEW_LIMIT).map((item) => <KeyValuePair key={item.field} label={item.field} value={item.value === "" ? "Not available" : item.value} />)}
                                    </KeyValueGrid>
                                </section>
                                <section className={"property-detail-group"}>
                                    <span className={"app-shell__eyebrow"}>{"Price snapshot"}</span>
                                    <KeyValueGrid compact>
                                        <KeyValuePair label={"Latest change"} value={summaryQuery.data?.latest_change_summary !== undefined && summaryQuery.data.latest_change_summary !== "" ? summaryQuery.data.latest_change_summary : "Not available"} />
                                        <KeyValuePair label={"Last update"} value={latestSnapshot?.observed_at !== undefined ? formatDateTime(latestSnapshot.observed_at) : propertyQuery.data.updated_at === undefined ? "Not available" : formatDateTime(propertyQuery.data.updated_at)} />
                                    </KeyValueGrid>
                                </section>
                                <section className={"property-detail-group"}>
                                    <span className={"app-shell__eyebrow"}>{"Status indicators"}</span>
                                    <KeyValueGrid compact>
                                        <KeyValuePair label={"Tracking status"} value={<StatusBadge tone={automationStatusTone} value={automationStatus} />} />
                                        <KeyValuePair label={"Property status"} value={<StatusBadge tone={propertyQuery.data.status === "active" ? "success" : propertyQuery.data.status === "degraded" ? "warning" : propertyQuery.data.status === "inactive" ? "danger" : "neutral"} value={propertyQuery.data.status} />} />
                                        <KeyValuePair label={"Extraction health"} value={<StatusBadge tone={latestSnapshot?.is_valid === false ? "danger" : missingFieldCount > 0 ? "warning" : latestSnapshot === undefined ? "neutral" : "success"} value={extractionHealthLabel} />} />
                                        <KeyValuePair label={"Next run"} value={propertyQuery.data.next_run_at === undefined ? manualEntryMode ? "Manual only" : "Not available" : formatDateTime(propertyQuery.data.next_run_at)} />
                                    </KeyValueGrid>
                                </section>
                                <section className={"property-detail-group"}>
                                    <span className={"app-shell__eyebrow"}>{"Source summary"}</span>
                                    <KeyValueGrid compact>
                                        <KeyValuePair label={"Source name"} value={sourceSummary} />
                                        <KeyValuePair label={"Last sync"} value={propertyQuery.data.last_run_at === undefined ? "Not available" : formatDateTime(propertyQuery.data.last_run_at)} />
                                        <KeyValuePair label={"Source config"} value={sourceConfigLink === undefined ? "Not available" : <Link className={"property-detail-anchor"} to={sourceConfigLink}>{"Open source config"}</Link>} />
                                        <KeyValuePair label={"Bookmark"} value={isBookmarked ? "Bookmarked" : "Not bookmarked"} />
                                    </KeyValueGrid>
                                </section>
                            </div>
                        ) : null}
                    </PageCard>
                ) : null}

                {activeSection === "overview" ? (
                    <PageCard
                        description={"All remaining captured fields and tags are shown explicitly so missing values are not mistaken for empty UI."}
                        title={"Captured fields"}
                        titleId={"profile"}
                    >
                        <div className={"property-detail-group-grid"}>
                            <section className={"property-detail-group"}>
                                <span className={"app-shell__eyebrow"}>{"All captured attributes"}</span>
                                {propertyFactRows.length === 0 ? <EmptyState message={"No property facts have been captured yet. Run the source again or add details manually."} /> : (
                                    <KeyValueGrid compact>
                                        {propertyFactRows.map((item) => <KeyValuePair key={item.field} label={item.field} value={item.value} />)}
                                    </KeyValueGrid>
                                )}
                            </section>
                        </div>
                        {(propertyTagsQuery.data ?? []).length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
                                {(propertyTagsQuery.data ?? []).map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                            </div>
                        ) : null}
                    </PageCard>
                ) : null}

                {activeSection === "insights" ? (
                    <PageCard description={"Separates price inputs, computed metrics, and history so pricing signals are easy to scan."} title={"Price Intelligence"} titleId={"price-intelligence"}>
                        {summaryQuery.data === undefined || pricingInsight === undefined ? <EmptyState message={"Price intelligence will appear after the first property summary is available."} /> : (
                            <div className={"property-section-stack"}>
                                <section className={"property-price-hero"}>
                                    <div className={"property-price-hero__header"}>
                                        <div className={"property-price-hero__intro"}>
                                            <span className={"app-shell__eyebrow"}>{"Pricing posture"}</span>
                                            <h3 className={"property-price-hero__title"}>{formatPriceClassification(pricingInsight.classification)}</h3>
                                            <p className={"muted-copy"}>
                                                {summaryQuery.data.latest_change_summary === ""
                                                    ? `Benchmarking this listing against ${pricingInsight.benchmark_label}.`
                                                    : summaryQuery.data.latest_change_summary}
                                            </p>
                                        </div>
                                        <div className={"property-price-hero__badges"}>
                                            <StatusBadge tone={getPriceClassificationTone(pricingInsight.classification)} value={formatPriceClassification(pricingInsight.classification)} />
                                            <StatusBadge tone={getFreshnessTone(summaryQuery.data.decision.freshness_status)} value={summaryQuery.data.decision.freshness_status} />
                                            <StatusBadge tone={"neutral"} value={formatDecisionStatus(summaryQuery.data.decision.stage)} />
                                        </div>
                                    </div>

                                    <div className={"property-price-hero__metrics"}>
                                        <PriceMetricCard
                                            emphasis
                                            label={"Current price"}
                                            meta={pricingInsight.current_price_per_unit !== undefined ? `${formatEuro(pricingInsight.current_price_per_unit)} per m²` : "Per-square-meter price not captured yet."}
                                            value={attributes.totalPrice ?? "Not captured"}
                                        />
                                        <PriceMetricCard
                                            label={pricingInsight.benchmark_label === "target price" ? "Primary benchmark" : "Market benchmark"}
                                            meta={pricingInsight.benchmark_label === "target price"
                                                ? "Anchored to your target price."
                                                : pricingInsight.comparable_count > 0
                                                    ? `${pricingInsight.comparable_count} comparable${pricingInsight.comparable_count === 1 ? "" : "s"}`
                                                    : "Need more comparable properties."}
                                            value={pricingInsight.benchmark_value !== undefined ? formatEuro(pricingInsight.benchmark_value) : "Not set"}
                                        />
                                        <PriceMetricCard
                                            label={"Gap vs target"}
                                            meta={pricingInsight.target_delta_absolute !== undefined ? formatSignedEuro(pricingInsight.target_delta_absolute) : "Set a target price to compare."}
                                            tone={getPriceMetricTone(pricingInsight.target_delta_percent)}
                                            value={formatSignedPercent(pricingInsight.target_delta_percent)}
                                        />
                                        <PriceMetricCard
                                            label={"Gap vs market"}
                                            meta={pricingInsight.market_delta_absolute !== undefined ? formatSignedEuro(pricingInsight.market_delta_absolute) : "Need more comparable properties."}
                                            tone={getPriceMetricTone(pricingInsight.market_delta_percent)}
                                            value={formatSignedPercent(pricingInsight.market_delta_percent)}
                                        />
                                    </div>
                                </section>

                                <div className={"property-detail-group-grid"}>
                                    <section className={"property-detail-group"}>
                                        <span className={"app-shell__eyebrow"}>{"Benchmark breakdown"}</span>
                                        <div className={"property-price-detail-grid"}>
                                            <div className={"property-price-detail"}>
                                                <span className={"property-price-detail__label"}>{"Target price"}</span>
                                                <strong className={"property-price-detail__value property-price-detail__value--neutral"}>{pricingInsight.target_price !== undefined ? formatEuro(pricingInsight.target_price) : "Not set"}</strong>
                                            </div>
                                            <div className={"property-price-detail"}>
                                                <span className={"property-price-detail__label"}>{"Market average"}</span>
                                                <strong className={"property-price-detail__value property-price-detail__value--neutral"}>{pricingInsight.market_average !== undefined ? formatEuro(pricingInsight.market_average) : "Not enough comparables"}</strong>
                                            </div>
                                            <div className={"property-price-detail"}>
                                                <span className={"property-price-detail__label"}>{"Benchmark"}</span>
                                                <strong className={"property-price-detail__value property-price-detail__value--neutral"}>{pricingInsight.benchmark_value !== undefined ? formatEuro(pricingInsight.benchmark_value) : "Not set"}</strong>
                                            </div>
                                            <div className={"property-price-detail"}>
                                                <span className={"property-price-detail__label"}>{"Latest extracted €/m²"}</span>
                                                <strong className={"property-price-detail__value property-price-detail__value--neutral"}>{pricingInsight.current_price_per_unit !== undefined ? formatEuro(pricingInsight.current_price_per_unit) : "Not captured"}</strong>
                                            </div>
                                            <div className={"property-price-detail"}>
                                                <span className={"property-price-detail__label"}>{"Decision status"}</span>
                                                <strong className={"property-price-detail__value property-price-detail__value--neutral"}>{formatDecisionStatus(summaryQuery.data.decision.stage)}</strong>
                                            </div>
                                            <div className={"property-price-detail"}>
                                                <span className={"property-price-detail__label"}>{"Comparables"}</span>
                                                <strong className={"property-price-detail__value property-price-detail__value--neutral"}>{`${pricingInsight.comparable_count}`}</strong>
                                            </div>
                                        </div>
                                    </section>
                                    <section className={"property-detail-group"}>
                                        <span className={"app-shell__eyebrow"}>{"History & trends"}</span>
                                        <div className={"property-history-card"}>
                                            <div className={"listing-dense-row__headline"}>
                                                <div className={"page-card__title-row"}>
                                                    <strong>{"Price history"}</strong>
                                                    <ContextualHelp content={"Use the compact chart for trend direction, then expand when you need exact timestamps."} title={"Price history"} />
                                                </div>
                                                <Button disabled={priceHistoryPoints.length === 0} onClick={() => { setChartOpen(true); }} size={"small"} variant={"secondary"}>{"Expand chart"}</Button>
                                            </div>
                                            {priceHistoryPoints.length === 0 ? <p className={"muted-copy"}>{"No historical price snapshots yet."}</p> : <PriceHistoryChart compact points={priceHistoryPoints} />}
                                        </div>
                                        <div className={"property-inline-note"}>
                                            <strong>{summaryQuery.data.latest_change_summary === "" ? "No recent pricing change summary." : summaryQuery.data.latest_change_summary}</strong>
                                            <span>{primarySignals.length === 0 ? "Price is the only live signal for this property right now." : `${primarySignals.length} tracked signal${primarySignals.length === 1 ? "" : "s"} available.`}</span>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                        {savePropertyMutation.isError ? <ErrorBanner>{"Could not save property. Check the price, source details, and any optional URL."}</ErrorBanner> : null}
                    </PageCard>
                ) : null}

                {activeSection === "insights" ? (
                    <PageCard description={"Signals from the latest summary, separated by primary monitoring and prefill-only listing fact changes."} title={"Change Signals"} titleId={"signals"}>
                        {summaryQuery.data === undefined || summaryQuery.data.signals.length === 0 ? <EmptyState message={"No signals detected for this property yet."} /> : (
                            <Tabs
                                defaultTabId={"all"}
                                items={[
                                    {
                                        id: "all",
                                        label: "All signals",
                                        panel: (
                                            <DataTable
                                                caption={"Change signals"}
                                                columns={[
                                                    { cell: (item) => item.label, header: "Signal", id: "label", sortValue: (item) => item.label },
                                                    { cell: (item) => item.group, header: "Group", id: "group", sortValue: (item) => item.group },
                                                    { cell: (item) => item.impact, header: "Impact", id: "impact", sortValue: (item) => item.impact },
                                                    { cell: (item) => item.previous ?? "—", header: "Previous", id: "previous" },
                                                    { cell: (item) => item.current ?? "—", header: "Current", id: "current" },
                                                    { cell: (item) => formatDateTime(item.observed_at), header: "Observed at", id: "observed_at", sortValue: (item) => item.observed_at },
                                                ]}
                                                compact
                                                emptyMessage={"No signals detected."}
                                                getRowId={(item) => item.field}
                                                items={primarySignals}
                                                pageSize={10}
                                            />
                                        ),
                                    },
                                    {
                                        id: "pricing",
                                        label: "Pricing",
                                        panel: (
                                            <DataTable
                                                caption={"Pricing signals"}
                                                columns={[
                                                    { cell: (item) => item.label, header: "Signal", id: "label" },
                                                    { cell: (item) => item.impact, header: "Impact", id: "impact" },
                                                    { cell: (item) => item.previous ?? "—", header: "Previous", id: "previous" },
                                                    { cell: (item) => item.current ?? "—", header: "Current", id: "current" },
                                                ]}
                                                compact
                                                emptyMessage={"No pricing signals."}
                                                getRowId={(item) => item.field}
                                                items={primarySignals.filter((signal) => signal.group === "pricing")}
                                                pageSize={10}
                                            />
                                        ),
                                    },
                                    {
                                        id: "data_quality",
                                        label: "Data quality",
                                        panel: (
                                            <DataTable
                                                caption={"Data quality signals"}
                                                columns={[
                                                    { cell: (item) => item.label, header: "Signal", id: "label" },
                                                    { cell: (item) => item.impact, header: "Impact", id: "impact" },
                                                    { cell: (item) => item.field, header: "Field", id: "field" },
                                                ]}
                                                compact
                                                emptyMessage={"No data quality signals."}
                                                getRowId={(item) => item.field}
                                                items={primarySignals.filter((signal) => signal.group === "data_quality" || signal.group === "freshness")}
                                                pageSize={10}
                                            />
                                        ),
                                    },
                                    {
                                        id: "listing_facts",
                                        label: "Listing facts changed",
                                        panel: (
                                            <div className={"property-section-stack"}>
                                                <div className={"page-card__title-row"}>
                                                    <strong>{"Listing fact updates"}</strong>
                                                    <ContextualHelp content={"This field is marked as Prefill, so changes are shown as listing updates instead of primary monitoring alerts."} title={"Listing fact updates"} />
                                                </div>
                                                <DataTable
                                                    caption={"Listing facts changed"}
                                                    columns={[
                                                        { cell: (item) => item.field, header: "Field", id: "field" },
                                                        { cell: (item) => item.previous ?? "—", header: "Previous", id: "previous" },
                                                        { cell: (item) => item.current ?? "—", header: "Current", id: "current" },
                                                    ]}
                                                    compact
                                                    emptyMessage={"No listing fact changes."}
                                                    getRowId={(item) => item.field}
                                                    items={listingFactSignals}
                                                    pageSize={10}
                                                />
                                            </div>
                                        ),
                                    },
                                ]}
                            />
                        )}
                    </PageCard>
                ) : null}

                {activeSection === "insights" && !manualEntryMode ? (
                    <PageCard description={"Recent automation runs with auto-refresh every 5 seconds."} title={"Automation Runs"}>
                        <DataTable
                            caption={"Property automation runs"}
                            columns={[
                                { cell: (item) => <StatusBadge tone={runStatusTone(item.status)} value={item.status} />, header: "Status", id: "status", width: "8rem" },
                                { cell: (item) => item.trigger_kind, header: "Trigger", id: "trigger", width: "8rem" },
                                { cell: (item) => `${item.attempt_count} / ${item.max_attempts}`, header: "Attempts", id: "attempts", width: "8rem" },
                                { cell: (item) => item.started_at !== undefined ? formatDateTime(item.started_at) : "—", header: "Started", id: "started_at", sortValue: (item) => item.started_at ?? "", width: "11rem" },
                                { cell: (item) => item.finished_at !== undefined ? formatDateTime(item.finished_at) : "—", header: "Finished", id: "finished_at", sortValue: (item) => item.finished_at ?? "", width: "11rem" },
                                {
                                    cell: (item) => {
                                        if (item.error_message === undefined || item.error_message === "") {
                                            return "—";
                                        }

                                        const truncated = item.error_message.length > 50 ? `${item.error_message.slice(0, 50)}...` : item.error_message;
                                        return (
                                            <Tooltip content={item.error_message}>
                                                <span style={{ color: "#dc2626" }}>{truncated}</span>
                                            </Tooltip>
                                        );
                                    },
                                    header: "Error",
                                    id: "error",
                                },
                            ]}
                            compact
                            emptyMessage={"No automation runs recorded yet."}
                            getRowId={(item) => item.id}
                            items={propertyRunsQuery.data ?? []}
                            pageSize={10}
                            rowLabel={(item) => `Run ${item.id}`}
                        />
                    </PageCard>
                ) : null}

                {activeSection === "insights" ? (
                    <PageCard description={"Recent snapshots stay close to pricing analysis so observed changes are easy to trace."} title={"Recent Snapshots"}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
                            <div className={"page-card__title-row"}>
                                <strong>{"Config filter"}</strong>
                                <ContextualHelp content={"Filter snapshots by the config version that produced them."} title={"Config filter"} />
                            </div>
                            <ActionGroup>
                                <Select onChange={(event) => { setSnapshotConfigFilter(Number(event.target.value)); }} value={`${snapshotConfigFilter}`}>
                                    <option value={"0"}>{"All versions"}</option>
                                    {configVersions.map((config) => <option key={config.id} value={`${config.version}`}>{`Version ${config.version}`}</option>)}
                                </Select>
                                <Button onClick={() => { setExportOpen(true); }} size={"small"} variant={"secondary"}>{"Export"}</Button>
                            </ActionGroup>
                        </div>
                        <DataTable
                            caption={"Recent property snapshots"}
                            columns={[
                                { cell: (item) => item.id, header: "Snapshot", id: "id", sortValue: (item) => item.id },
                                { cell: (item) => formatDateTime(item.observed_at), header: "Observed", id: "observed_at", sortValue: (item) => item.observed_at },
                                { cell: (item) => <StatusBadge tone={item.is_valid ? "success" : "warning"} value={item.is_valid ? "valid" : "invalid"} />, header: "Status", id: "status" },
                                { align: "right", cell: (item) => `${Object.keys(item.values).length}`, header: "Fields", id: "fields", sortValue: (item) => Object.keys(item.values).length },
                            ]}
                            compact
                            emptyMessage={"No runs have been recorded for this property yet."}
                            getRowId={(item) => item.id}
                            items={recentRuns}
                            onRowClick={(item) => { void navigate(`/runs/${item.id}`); }}
                            pageSize={8}
                            rowLabel={(item) => `Open run ${item.id}`}
                        />
                    </PageCard>
                ) : null}

                {activeSection === "notes-decisions" ? (
                    <PageCard description={"Edit decision context, notes, and supporting references directly inside the section where they are reviewed."} title={"Notes & Decisions"} titleId={"notes-decisions"}>
                        <div className={"property-section-stack"}>
                            <FormGrid variant={"two-column"}>
                                <Field label={"Decision status"}>
                                    <Select aria-label={"Decision status"} onChange={(event) => { setMetadataDraft((current) => ({ ...current, businessStage: event.target.value })); }} value={metadataDraft.businessStage}>
                                        <option value={""}>{"Not set"}</option>
                                        <option value={"candidate"}>{"Candidate"}</option>
                                        <option value={"shortlisted"}>{"Shortlisted"}</option>
                                        <option value={"rejected"}>{"Rejected"}</option>
                                    </Select>
                                </Field>
                                <Field label={"Priority"}>
                                    <Select aria-label={"Priority"} onChange={(event) => { setMetadataDraft((current) => ({ ...current, priorityLevel: event.target.value })); }} value={metadataDraft.priorityLevel}>
                                        <option value={""}>{"Not set"}</option>
                                        <option value={"low"}>{"Low"}</option>
                                        <option value={"medium"}>{"Medium"}</option>
                                        <option value={"high"}>{"High"}</option>
                                        <option value={"critical"}>{"Critical"}</option>
                                    </Select>
                                </Field>
                                <Field label={"Target price"}>
                                    <Input aria-label={"Target price"} min={0} onChange={(event) => { setMetadataDraft((current) => ({ ...current, targetPrice: event.target.value })); }} prefix={"€"} type={"number"} value={metadataDraft.targetPrice} />
                                </Field>
                                <Field label={"Expected rent"}>
                                    <Input aria-label={"Expected rent"} min={0} onChange={(event) => { setMetadataDraft((current) => ({ ...current, expectedRent: event.target.value })); }} prefix={"€"} type={"number"} value={metadataDraft.expectedRent} />
                                </Field>
                                <Field label={"Expected yield (%)"}>
                                    <Input aria-label={"Expected yield (%)"} min={0} onChange={(event) => { setMetadataDraft((current) => ({ ...current, expectedYieldPercent: event.target.value })); }} step={"0.1"} type={"number"} value={metadataDraft.expectedYieldPercent} />
                                </Field>
                                <Field fullWidth label={"Notes"}>
                                    <Textarea aria-label={"Notes"} onChange={(event) => { setMetadataDraft((current) => ({ ...current, acquisitionNotes: event.target.value })); }} rows={4} value={metadataDraft.acquisitionNotes} />
                                </Field>
                                <Field fullWidth label={"Thesis"}>
                                    <Textarea aria-label={"Thesis"} onChange={(event) => { setMetadataDraft((current) => ({ ...current, dealThesis: event.target.value })); }} rows={4} value={metadataDraft.dealThesis} />
                                </Field>
                                <Field fullWidth hint={"One reference per line as label|value."} label={"External references"}>
                                    <Textarea aria-label={"External references"} onChange={(event) => { setMetadataDraft((current) => ({ ...current, externalReferencesText: event.target.value })); }} rows={4} value={metadataDraft.externalReferencesText} />
                                </Field>
                                <Field fullWidth hint={"One attachment per line as label|url."} label={"Attachments"}>
                                    <Textarea aria-label={"Attachments"} onChange={(event) => { setMetadataDraft((current) => ({ ...current, attachmentsText: event.target.value })); }} rows={4} value={metadataDraft.attachmentsText} />
                                </Field>
                            </FormGrid>
                            <ActionGroup>
                                <Button disabled={isPropertySaveDisabled} onClick={handlePropertySave}>{savePropertyMutation.isPending ? "Saving..." : "Save notes & decisions"}</Button>
                            </ActionGroup>
                            {savePropertyMutation.isError ? <ErrorBanner>{"Could not save property. Check the price, source details, and any optional URL."}</ErrorBanner> : null}
                            <section className={"property-detail-group"}>
                                <span className={"app-shell__eyebrow"}>{"Reference pack"}</span>
                                {externalReferences.length === 0 && attachments.length === 0 ? <EmptyState message={"No references or attachments have been saved for this property yet."} /> : (
                                    <div className={"property-section-stack"}>
                                        <div>
                                            <strong>{"External references"}</strong>
                                            {externalReferences.length === 0 ? <p className={"muted-copy"}>{"No external references saved."}</p> : (
                                                <ItemList>
                                                    {externalReferences.map((reference) => (
                                                        <ListRow key={`${reference.label}-${reference.value}`}>
                                                            <ListRowMain>
                                                                <div>
                                                                    <h3 className={"list-row__title"}>{reference.label}</h3>
                                                                    <p className={"list-row__meta"}>
                                                                        {isExternalHTTPURL(reference.value) ? <a className={"property-detail-anchor"} href={reference.value} rel={"noreferrer"} target={"_blank"}>{reference.value}</a> : reference.value}
                                                                    </p>
                                                                </div>
                                                            </ListRowMain>
                                                        </ListRow>
                                                    ))}
                                                </ItemList>
                                            )}
                                        </div>
                                        <div>
                                            <strong>{"Attachments"}</strong>
                                            {attachments.length === 0 ? <p className={"muted-copy"}>{"No attachments saved."}</p> : (
                                                <ItemList>
                                                    {attachments.map((attachment) => (
                                                        <ListRow key={`${attachment.label}-${attachment.url}`}>
                                                            <ListRowMain>
                                                                <div>
                                                                    <h3 className={"list-row__title"}>{attachment.label}</h3>
                                                                    <p className={"list-row__meta"}>
                                                                        <a className={"property-detail-anchor"} href={attachment.url} rel={"noreferrer"} target={"_blank"}>{attachment.url}</a>
                                                                    </p>
                                                                </div>
                                                            </ListRowMain>
                                                        </ListRow>
                                                    ))}
                                                </ItemList>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>
                            <section className={"property-detail-group"}>
                                <span className={"app-shell__eyebrow"}>{"Timestamped decision log"}</span>
                                {decisionEntries.length === 0 ? <EmptyState message={"No decision entries are available yet."} /> : (
                                    <DataTable
                                        caption={"Decision log"}
                                        columns={[
                                            { cell: (item) => item.label, header: "Entry", id: "label" },
                                            { cell: (item) => item.value, header: "Value", id: "value" },
                                            { cell: (item) => item.timestamp === undefined ? "—" : formatDateTime(item.timestamp), header: "Timestamp", id: "timestamp", sortValue: (item) => item.timestamp ?? "" },
                                        ]}
                                        compact
                                        emptyMessage={"No decision entries are available yet."}
                                        getRowId={(item) => `${item.label}-${item.value}`}
                                        items={decisionEntries}
                                        pageSize={5}
                                    />
                                )}
                            </section>
                        </div>
                    </PageCard>
                ) : null}

                {activeSection === "configuration" ? (
                    <>
                        <PageCard
                            description={"Manage property identity, tracking mode, source wiring, and operational controls here."}
                            title={"Configuration"}
                            titleId={"configuration"}
                        >
                            <FormGrid variant={"two-column"}>
                                <Field fullWidth hint={"Manual tracking removes URL, source, scraping, and extraction controls."} label={"Tracking mode"}>
                                    <div className={"dashboard-grid dashboard-grid--double"}>
                                        <label className={"properties-table__column-toggle"}>
                                            <input checked={trackingMode === "automatic"} onChange={() => { setTrackingMode("automatic"); }} type={"radio"} />
                                            <span>{"Automatic Tracking"}</span>
                                        </label>
                                        <label className={"properties-table__column-toggle"}>
                                            <input checked={trackingMode === "manual"} onChange={() => { setTrackingMode("manual"); }} type={"radio"} />
                                            <span>{"Manual Tracking"}</span>
                                        </label>
                                    </div>
                                </Field>
                                <Field label={"Label"}>
                                    <Input id={"prop-label"} onChange={(event) => { setLabel(event.target.value); }} placeholder={"Optional display name"} type={"text"} value={label} />
                                </Field>
                                {!manualEntryMode ? (
                                    <>
                                        <Field error={urlError} fullWidth label={"Source URL"}>
                                            <Input id={"prop-url"} invalid={urlError !== undefined} onChange={(event) => { setUrl(event.target.value); }} placeholder={"https://example.com/property/123"} type={"url"} value={url} />
                                        </Field>
                                        <Field label={"Source template"}>
                                            <Select id={"prop-source"} onChange={(event) => { setSourceId(event.target.value); }} value={sourceId}>
                                                <option value={""}>{"No template"}</option>
                                                {(sourcesQuery.data ?? []).map((source) => {
                                                    return <option key={source.id} value={source.id}>{source.name}</option>;
                                                })}
                                            </Select>
                                        </Field>
                                    </>
                                ) : null}
                            </FormGrid>
                            {manualEntryMode ? manualAttributeEditor : null}
                            <ActionGroup>
                                <Button disabled={isPropertySaveDisabled} onClick={handlePropertySave}>{savePropertyMutation.isPending ? "Saving..." : manualEntryMode ? "Save manual snapshot" : "Save settings"}</Button>
                                <Button onClick={() => { setDeleteOpen(true); }} variant={"secondary"}>{"Delete"}</Button>
                            </ActionGroup>
                            {savePropertyMutation.isError ? <ErrorBanner>{"Could not save property. Check the price, source details, and any optional URL."}</ErrorBanner> : null}
                        </PageCard>
                        <PageCard
                            action={(
                                <Button onClick={() => { setTagsOpen(true); }} variant={"secondary"}>{"Edit tags"}</Button>
                            )}
                            description={"Manage tags here so categorization stays with the rest of the property settings."}
                            title={"Tags"}
                        >
                            {propertyTagsQuery.isLoading ? <p className={"muted-copy"}>{"Loading tags..."}</p> : null}
                            {(propertyTagsQuery.data ?? []).length === 0 && !propertyTagsQuery.isLoading
                                ? <EmptyState message={"No tags assigned. Click 'Edit tags' to add tags."} />
                                : (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                        {(propertyTagsQuery.data ?? []).map((tag) => <TagBadge key={tag.id} tag={tag} />)}
                                    </div>
                                )}
                        </PageCard>
                        {!manualEntryMode ? (
                            <PageCard description={"Review which source fields prefill property facts and which ones stay under live monitoring."} title={"Source Fields"}>
                                <KeyValueGrid compact>
                                    <KeyValuePair label={"URL"} value={propertyQuery.data?.url !== undefined && propertyQuery.data.url !== "" ? propertyQuery.data.url : "Manual property"} />
                                    <KeyValuePair label={"Source template"} value={sourcesQuery.data?.find((source) => source.id === propertyQuery.data?.source_id)?.name ?? "No template"} />
                                </KeyValueGrid>
                                {isTemplateDetached && !detachmentAlertDismissed ? (
                                    <div className={"property-inline-alert"} role={"status"}>
                                        <span className={"property-inline-alert__copy"}>
                                            <strong>{"Template link removed for this property."}</strong>
                                            <span>{"This field setup no longer matches the selected template, so future template updates will not apply automatically."}</span>
                                        </span>
                                        <Button onClick={() => { setDetachmentAlertDismissed(true); }} size={"small"} variant={"ghost"}>
                                            {"Dismiss"}
                                        </Button>
                                    </div>
                                ) : null}
                                {unmatchedTemplateFields.length > 0 ? (
                                    <div className={"property-unmatched-fields"} role={"status"}>
                                        <strong>{"Unmatched template fields"}</strong>
                                        <span>{"These source fields are not mapped on this property yet. Create mappings explicitly so they are not silently ignored."}</span>
                                        <div className={"property-unmatched-fields__actions"}>
                                            {unmatchedTemplateFields.map((field) => (
                                                <Button key={field.name} onClick={() => { addTemplateMapping(field.name); }} size={"small"} variant={"secondary"}>
                                                    {`Create mapping: ${formatFieldName(field.name)}`}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                <SelectorBuilder fieldDefinitions={fieldDefinitionsQuery.data} fieldMetadataById={fieldMetadataById} fields={fieldRows} onChange={setFieldRows} onOverrideField={overrideTemplateField} onRevertField={revertTemplateField} previewByFieldName={previewMap} />
                                <ActionGroup>
                                    <Button onClick={() => { setFieldRows((rows) => [...rows, createEmptySelectorDraft()]); }} variant={"secondary"}>{"Add field"}</Button>
                                    <Button disabled={previewMutation.isPending || url.trim() === "" || validationMessages.length > 0} onClick={() => { previewMutation.mutate(); }} variant={"secondary"}>{previewMutation.isPending ? "Previewing..." : "Preview extraction"}</Button>
                                    <Button disabled={saveConfigMutation.isPending || validationMessages.length > 0} onClick={() => { saveConfigMutation.mutate(); }}>{saveConfigMutation.isPending ? "Saving..." : "Save configuration"}</Button>
                                </ActionGroup>
                                {validationMessages.length > 0 ? (
                                    <div className={"selector-builder__validation-list"}>
                                        {validationMessages.map((message) => <ErrorBanner key={message}>{message}</ErrorBanner>)}
                                    </div>
                                ) : null}
                                {saveConfigMutation.isError ? <ErrorBanner>{"Could not save configuration."}</ErrorBanner> : null}
                            </PageCard>
                        ) : null}
                        {!manualEntryMode ? (
                            <PageCard
                                action={(
                                    <ActionGroup>
                                        <Button disabled={bookmarkMutation.isPending} onClick={() => { bookmarkMutation.mutate(); }} variant={"secondary"}>
                                            {isBookmarked ? "Remove bookmark" : "Bookmark"}
                                        </Button>
                                        <Tooltip content={persistedRetrySummary}>
                                            <Button disabled={ingestMutation.isPending} onClick={() => { ingestMutation.mutate(); }}>
                                                {ingestMutation.isPending ? "Running..." : "Run now"}
                                            </Button>
                                        </Tooltip>
                                        <Button as={Link} to={`/runs?property_id=${resolvedId}`} variant={"secondary"}>{"View history"}</Button>
                                    </ActionGroup>
                                )}
                                description={`${persistedScheduleSummary}. ${persistedRetrySummary}`}
                                title={"Automation"}
                            >
                                <FormGrid variant={"two-column"}>
                                    <Field
                                        error={scheduleIntervalError}
                                        fullWidth
                                        hint={scheduleIntervalError === undefined ? "Runs every X minutes/hours using the saved backend schedule." : undefined}
                                        label={"Run interval"}
                                    >
                                        <div style={{ display: "grid", gap: "0.75rem" }}>
                                            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "minmax(0, 1fr) 11rem" }}>
                                                <Input
                                                    id={"prop-schedule-value"}
                                                    invalid={scheduleIntervalError !== undefined}
                                                    min={1}
                                                    onChange={(event) => { setScheduleIntervalValue(event.target.value); }}
                                                    placeholder={"15"}
                                                    type={"number"}
                                                    value={scheduleIntervalValue}
                                                />
                                                <Select
                                                    id={"prop-schedule-unit"}
                                                    invalid={scheduleIntervalError !== undefined}
                                                    onChange={(event) => { setScheduleIntervalUnit(event.target.value as DurationUnit); }}
                                                    value={scheduleIntervalUnit}
                                                >
                                                    <option value={"seconds"}>{"Seconds"}</option>
                                                    <option value={"minutes"}>{"Minutes"}</option>
                                                    <option value={"hours"}>{"Hours"}</option>
                                                </Select>
                                            </div>
                                            <ActionGroup>
                                                {SCHEDULE_PRESETS.map((preset) => {
                                                    const presetLabel = formatDurationFromSeconds(durationDraftToSeconds(preset.value, preset.unit) ?? 0);
                                                    return (
                                                        <Button
                                                            key={`${preset.value}-${preset.unit}`}
                                                            onClick={() => {
                                                                setScheduleIntervalValue(preset.value);
                                                                setScheduleIntervalUnit(preset.unit);
                                                            }}
                                                            size={"small"}
                                                            type={"button"}
                                                            variant={"secondary"}
                                                        >
                                                            {presetLabel}
                                                        </Button>
                                                    );
                                                })}
                                            </ActionGroup>
                                        </div>
                                    </Field>
                                    <Field hint={"Retry on failure before the base schedule resumes."} label={"Max attempts"}>
                                        <Input id={"prop-retry"} min={1} onChange={(event) => { setRetryMaxAttempts(readNonNegativeNumber(event.target.value, 1)); }} type={"number"} value={retryMaxAttempts} />
                                    </Field>
                                    <Field error={retryBackoffError} hint={"Retry interval between failed attempts."} label={"Retry interval (ms)"}>
                                        <Input
                                            id={"prop-backoff"}
                                            invalid={retryBackoffError !== undefined}
                                            min={MIN_RETRY_BACKOFF_MS}
                                            onChange={(event) => { setRetryBackoffMillis(readNonNegativeNumber(event.target.value, 500)); }}
                                            type={"number"}
                                            value={retryBackoffMillis}
                                        />
                                    </Field>
                                    <Field label={"Automation paused"}>
                                        <div className={"property-toggle-row"}>
                                            <Toggle checked={metadataDraft.paused} label={"Automation paused"} onCheckedChange={(nextChecked) => { setMetadataDraft((current) => ({ ...current, paused: nextChecked })); }} />
                                            <span className={"property-toggle-row__state"}>{metadataDraft.paused ? "On" : "Off"}</span>
                                        </div>
                                    </Field>
                                    {metadataDraft.paused ? (
                                        <Field fullWidth label={"Pause reason"}>
                                            <Input onChange={(event) => { setMetadataDraft((current) => ({ ...current, pauseReason: event.target.value })); }} placeholder={"Optional context for the pause"} type={"text"} value={metadataDraft.pauseReason} />
                                        </Field>
                                    ) : null}
                                </FormGrid>
                                <ActionGroup>
                                    <Button disabled={isPropertySaveDisabled} onClick={handlePropertySave}>{savePropertyMutation.isPending ? "Saving..." : "Save run configuration"}</Button>
                                </ActionGroup>
                                {savePropertyMutation.isError ? <ErrorBanner>{"Could not save property. Check the price, source details, and any optional URL."}</ErrorBanner> : null}
                                {propertyQuery.data !== undefined ? (
                                    <KeyValueGrid compact>
                                        <KeyValuePair label={"Scheduling"} value={persistedScheduleSummary} />
                                        <KeyValuePair label={"Next run"} value={propertyQuery.data.next_run_at === undefined ? "Waiting for save" : formatDateTime(propertyQuery.data.next_run_at)} />
                                        <KeyValuePair label={"Last run"} value={propertyQuery.data.last_run_at === undefined ? "No runs yet" : formatDateTime(propertyQuery.data.last_run_at)} />
                                        <KeyValuePair label={"Retry policy"} value={persistedRetrySummary} />
                                    </KeyValueGrid>
                                ) : null}
                                {latestSnapshot === undefined ? <EmptyState message={"No runs have been recorded for this property yet."} /> : (
                                    <>
                                        <KeyValueGrid compact>
                                            <KeyValuePair label={"Snapshot status"} value={<StatusBadge tone={latestSnapshot.is_valid ? "success" : "warning"} value={latestSnapshot.is_valid ? "valid" : "invalid"} />} />
                                            <KeyValuePair label={"Observed at"} value={formatDateTime(latestSnapshot.observed_at)} />
                                        </KeyValueGrid>
                                        {latestSnapshot.error_message !== undefined && latestSnapshot.error_message !== "" ? <ErrorBanner>{latestSnapshot.error_message}</ErrorBanner> : null}
                                        <DataTable
                                            caption={"Current extracted values"}
                                            columns={[
                                                { cell: (item) => item.field, header: "Field", id: "field", sortValue: (item) => item.field },
                                                { cell: (item) => item.value, header: "Value", id: "value" },
                                                { cell: (item) => item.source, header: "Source", id: "source" },
                                                { cell: (item) => formatMappingState(item.state), header: "State", id: "state" },
                                                {
                                                    align: "right",
                                                    cell: (item) => (
                                                        <RowActions>
                                                            <Button as={Link} size={"small"} to={`/properties/${resolvedId}/fields/${encodeURIComponent(item.field)}/analysis`} variant={"ghost"}>
                                                                {"View Analysis"}
                                                            </Button>
                                                        </RowActions>
                                                    ),
                                                    header: "Actions",
                                                    id: "actions",
                                                },
                                            ]}
                                            compact
                                            emptyMessage={"No extracted values are available for the latest run."}
                                            getRowId={(item) => item.field}
                                            items={extractedValueRows}
                                            pageSize={8}
                                        />
                                    </>
                                )}
                            </PageCard>
                        ) : null}
                        <PageCard
                            action={(
                                <Button onClick={() => { setCreateAlertOpen(true); }} variant={"secondary"}>{"Create alert"}</Button>
                            )}
                            description={"Alert configuration stays with the rest of the operational setup so thresholds and automations stay together."}
                            title={"Alerts"}
                        >
                            {propertyAlerts.length === 0 ? <EmptyState message={"No alerts are linked to this property yet."} /> : (
                                <ItemList>
                                    {propertyAlerts.map((rule) => {
                                        return (
                                            <ListRow key={rule.id}>
                                                <ListRowMain>
                                                    <div>
                                                        <h3 className={"list-row__title"}>{getRuleTypeLabel(rule.rule_type)}</h3>
                                                        <p className={"list-row__meta"}>{getRuleTypeLogic(rule.rule_type, rule.threshold_amount)}</p>
                                                    </div>
                                                    <StatusBadge tone={rule.enabled ? "success" : "neutral"} value={rule.enabled ? "on" : "off"} />
                                                </ListRowMain>
                                            </ListRow>
                                        );
                                    })}
                                </ItemList>
                            )}
                        </PageCard>
                        {!manualEntryMode ? (
                            <PageCard description={"Compare any two saved configs, review the selector diff, and restore a previous version without losing history."} title={"Config History"}>
                                {configVersions.length === 0 ? <EmptyState message={"No config versions have been saved yet."} /> : (
                                    <Tabs
                                        defaultTabId={"history"}
                                        items={[
                                            {
                                                id: "history",
                                                label: "Versions",
                                                panel: (
                                                    <DataTable
                                                        caption={"Property config versions"}
                                                        columns={[
                                                            { cell: (item) => `v${item.version}`, header: "Version", id: "version", sortValue: (item) => item.version },
                                                            { cell: (item) => formatDateTime(item.created_at), header: "Created", id: "created_at", sortValue: (item) => item.created_at },
                                                            { cell: (item) => item.change_summary ?? "Saved configuration.", header: "Summary", id: "summary" },
                                                            {
                                                                align: "right",
                                                                cell: (item) => (
                                                                    <ActionGroup>
                                                                        <Button onClick={() => { setCompareLeftVersion(item.version); }} size={"small"} variant={"secondary"}>{"Compare from"}</Button>
                                                                        <Button onClick={() => { setCompareRightVersion(item.version); }} size={"small"} variant={"secondary"}>{"Compare to"}</Button>
                                                                        <Button onClick={() => { setRollbackTargetVersion(item.version); }} size={"small"} variant={"ghost"}>{"Rollback"}</Button>
                                                                    </ActionGroup>
                                                                ),
                                                                header: "Actions",
                                                                id: "actions",
                                                            },
                                                        ]}
                                                        compact
                                                        emptyMessage={"No config versions have been saved yet."}
                                                        getRowId={(item) => item.id}
                                                        items={configVersions}
                                                        pageSize={6}
                                                    />
                                                ),
                                            },
                                            {
                                                id: "diff",
                                                label: "Structured diff",
                                                panel: (
                                                    <div style={{ display: "grid", gap: "1rem" }}>
                                                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                                                            <Field label={"Compare from"}>
                                                                <Select onChange={(event) => { setCompareLeftVersion(Number(event.target.value)); }} value={`${selectedLeftConfig?.version ?? 0}`}>
                                                                    {configVersions.map((config) => <option key={`left-${config.id}`} value={`${config.version}`}>{`Version ${config.version}`}</option>)}
                                                                </Select>
                                                            </Field>
                                                            <Field label={"Compare to"}>
                                                                <Select onChange={(event) => { setCompareRightVersion(Number(event.target.value)); }} value={`${selectedRightConfig?.version ?? 0}`}>
                                                                    {configVersions.map((config) => <option key={`right-${config.id}`} value={`${config.version}`}>{`Version ${config.version}`}</option>)}
                                                                </Select>
                                                            </Field>
                                                        </div>
                                                        <KeyValueGrid compact>
                                                            <KeyValuePair label={"Changed fields"} value={`${configDiff.changedCount}`} />
                                                            <KeyValuePair label={"From summary"} value={selectedLeftConfig?.change_summary ?? "Saved configuration."} />
                                                            <KeyValuePair label={"To summary"} value={selectedRightConfig?.change_summary ?? "Saved configuration."} />
                                                        </KeyValueGrid>
                                                        {configDiff.changes.length === 0 ? <EmptyState message={"The selected versions use the same selector definitions."} /> : (
                                                            <DataTable
                                                                caption={"Config diff"}
                                                                columns={[
                                                                    { cell: (item) => item.field, header: "Field", id: "field", sortValue: (item) => item.field },
                                                                    { cell: (item) => item.type, header: "Change", id: "type", sortValue: (item) => item.type },
                                                                    { cell: (item) => item.previous?.selector_value ?? "—", header: "Previous selector", id: "previous" },
                                                                    { cell: (item) => item.next?.selector_value ?? "—", header: "Current selector", id: "current" },
                                                                ]}
                                                                compact
                                                                emptyMessage={"No selector-level changes found."}
                                                                getRowId={(item) => `${item.type}-${item.field}`}
                                                                items={configDiff.changes}
                                                                pageSize={8}
                                                            />
                                                        )}
                                                    </div>
                                                ),
                                            },
                                        ]}
                                    />
                                )}
                            </PageCard>
                        ) : null}
                    </>
                ) : null}
            </PageStack>

            <ConfirmDialog
                confirmLabel={"Delete property"}
                description={`Delete ${propertyQuery.data?.label !== undefined && propertyQuery.data.label !== "" ? propertyQuery.data.label : propertyQuery.data?.url ?? "this property"}? This also removes its runs, alerts, bookmarks, and extraction config.`}
                isPending={deleteMutation.isPending}
                onConfirm={() => {
                    deleteMutation.mutate(resolvedId);
                }}
                onOpenChange={setDeleteOpen}
                open={deleteOpen}
                title={"Delete property"}
            />
            <PropertyAlertCreateDialog
                onOpenChange={setCreateAlertOpen}
                open={createAlertOpen}
                propertyId={resolvedId}
                propertyLabel={propertyQuery.data?.label !== undefined && propertyQuery.data.label !== "" ? propertyQuery.data.label : propertyQuery.data?.url ?? "this property"}
            />
            <TagPicker
                onChange={(tagIds) => { updateTagsMutation.mutate(tagIds); }}
                onOpenChange={setTagsOpen}
                open={tagsOpen}
                selectedTagIds={(propertyTagsQuery.data ?? []).map((tag) => tag.id)}
            />
            <ConfirmDialog
                confirmLabel={"Roll back config"}
                description={rollbackTargetVersion === null ? "" : `Restore config version ${rollbackTargetVersion} by creating a new version? This preserves history and keeps the rollback auditable.`}
                isPending={rollbackConfigMutation.isPending}
                onConfirm={() => {
                    if (rollbackTargetVersion !== null) {
                        rollbackConfigMutation.mutate(rollbackTargetVersion);
                    }
                }}
                onOpenChange={(open) => { if (!open) { setRollbackTargetVersion(null); } }}
                open={rollbackTargetVersion !== null}
                title={"Confirm rollback"}
            />
            <Dialog
                actions={(
                    <ActionGroup>
                        <Button onClick={() => { setExportOpen(false); }} variant={"secondary"}>{"Cancel"}</Button>
                        <Button
                            onClick={() => {
                                if (propertyQuery.data !== undefined) {
                                    downloadPropertySnapshotExport(propertyQuery.data, recentRuns, exportFormat);
                                }

                                setExportOpen(false);
                            }}
                        >
                            {`Download ${exportFormat.toUpperCase()}`}
                        </Button>
                    </ActionGroup>
                )}
                description={"Download the current property snapshot history as CSV or JSON."}
                onOpenChange={setExportOpen}
                open={exportOpen}
                title={"Export snapshots"}
            >
                <div className={"dashboard-grid"}>
                    <label className={"properties-table__column-toggle"}>
                        <input checked={exportFormat === "csv"} onChange={() => { setExportFormat("csv"); }} type={"radio"} />
                        <span>{"CSV"}</span>
                    </label>
                    <label className={"properties-table__column-toggle"}>
                        <input checked={exportFormat === "json"} onChange={() => { setExportFormat("json"); }} type={"radio"} />
                        <span>{"JSON"}</span>
                    </label>
                </div>
            </Dialog>
            <Dialog
                actions={<ActionGroup><Button onClick={() => { setChartOpen(false); }} variant={"secondary"}>{"Close"}</Button></ActionGroup>}
                description={"Hover to inspect exact prices and timestamps across the full history."}
                onOpenChange={setChartOpen}
                open={chartOpen}
                title={"Price history"}
            >
                <PriceHistoryChart points={priceHistoryPoints} />
            </Dialog>
        </>
    );
};
