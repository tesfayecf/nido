export interface WorkspaceThresholdSettings {
    readonly cheap_below_percent: number;
    readonly expensive_above_percent: number;
}

export interface WorkspaceFieldMappings {
    readonly area_fields: string[];
    readonly comparable_fields: string[];
    readonly location_fields: string[];
    readonly price_fields: string[];
    readonly type_fields: string[];
}

export interface WorkspaceOperationSettings {
    readonly allow_empty_price_on_create: boolean;
    readonly auto_preview_on_create: boolean;
    readonly default_retry_backoff_millis: number;
    readonly default_retry_max_attempts: number;
    readonly default_schedule_interval_unit: "hours" | "minutes" | "seconds";
    readonly default_schedule_interval_value: string;
    readonly default_source_id: string;
    readonly paused_source_ids: string[];
    readonly paused_tag_ids: string[];
}

export interface WorkspacePreferenceSettings {
    readonly density: "comfortable" | "compact";
    readonly display_currency: string;
    readonly display_locale: string;
}

export interface WorkspaceSettings {
    readonly field_mappings: WorkspaceFieldMappings;
    readonly operations: WorkspaceOperationSettings;
    readonly preferences: WorkspacePreferenceSettings;
    readonly thresholds: WorkspaceThresholdSettings;
}

export const WORKSPACE_SETTINGS_STORAGE_KEY = "nido.workspace-settings";

export const FIELD_MAPPING_GROUPS: { key: keyof WorkspaceFieldMappings; label: string; }[] = [
    { key: "price_fields", label: "Price" },
    { key: "area_fields", label: "Area" },
    { key: "location_fields", label: "Location" },
    { key: "type_fields", label: "Type" },
    { key: "comparable_fields", label: "Comparable" },
];

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
    field_mappings: {
        area_fields: ["area_m2", "surface_area", "surface", "area", "size_m2", "surface_m2", "m2"],
        comparable_fields: ["location", "district", "neighborhood", "city", "type", "property_type"],
        location_fields: ["location", "district", "neighborhood", "city"],
        price_fields: ["price", "total_price", "price_amount", "listing_price", "asking_price"],
        type_fields: ["type", "property_type", "listing_type"],
    },
    operations: {
        allow_empty_price_on_create: true,
        auto_preview_on_create: false,
        default_retry_backoff_millis: 500,
        default_retry_max_attempts: 1,
        default_schedule_interval_unit: "minutes",
        default_schedule_interval_value: "",
        default_source_id: "",
        paused_source_ids: [],
        paused_tag_ids: [],
    },
    preferences: {
        density: "comfortable",
        display_currency: "EUR",
        display_locale: "en-IE",
    },
    thresholds: {
        cheap_below_percent: 5,
        expensive_above_percent: 5,
    },
};

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const readStringArray = (value: unknown, fallback: readonly string[]): string[] => {
    return Array.isArray(value)
        ? value.map((item) => `${item}`.trim()).filter((item) => item !== "")
        : [...fallback];
};

const readNumber = (value: unknown, fallback: number): number => {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const readString = (value: unknown, fallback: string): string => {
    return typeof value === "string" ? value : fallback;
};

export const normalizeWorkspaceSettings = (value: unknown): WorkspaceSettings => {
    if (!isObject(value)) {
        return DEFAULT_WORKSPACE_SETTINGS;
    }

    const thresholds = isObject(value.thresholds) ? value.thresholds : {};
    const preferences = isObject(value.preferences) ? value.preferences : {};
    const operations = isObject(value.operations) ? value.operations : {};
    const fieldMappings = isObject(value.field_mappings) ? value.field_mappings : {};

    return {
        field_mappings: {
            area_fields: readStringArray(fieldMappings.area_fields, DEFAULT_WORKSPACE_SETTINGS.field_mappings.area_fields),
            comparable_fields: readStringArray(fieldMappings.comparable_fields, DEFAULT_WORKSPACE_SETTINGS.field_mappings.comparable_fields),
            location_fields: readStringArray(fieldMappings.location_fields, DEFAULT_WORKSPACE_SETTINGS.field_mappings.location_fields),
            price_fields: readStringArray(fieldMappings.price_fields, DEFAULT_WORKSPACE_SETTINGS.field_mappings.price_fields),
            type_fields: readStringArray(fieldMappings.type_fields, DEFAULT_WORKSPACE_SETTINGS.field_mappings.type_fields),
        },
        operations: {
            allow_empty_price_on_create: typeof operations.allow_empty_price_on_create === "boolean"
                ? operations.allow_empty_price_on_create
                : DEFAULT_WORKSPACE_SETTINGS.operations.allow_empty_price_on_create,
            auto_preview_on_create: typeof operations.auto_preview_on_create === "boolean"
                ? operations.auto_preview_on_create
                : DEFAULT_WORKSPACE_SETTINGS.operations.auto_preview_on_create,
            default_retry_backoff_millis: readNumber(operations.default_retry_backoff_millis, DEFAULT_WORKSPACE_SETTINGS.operations.default_retry_backoff_millis),
            default_retry_max_attempts: readNumber(operations.default_retry_max_attempts, DEFAULT_WORKSPACE_SETTINGS.operations.default_retry_max_attempts),
            default_schedule_interval_unit: readString(
                operations.default_schedule_interval_unit,
                DEFAULT_WORKSPACE_SETTINGS.operations.default_schedule_interval_unit,
            ) as WorkspaceOperationSettings["default_schedule_interval_unit"],
            default_schedule_interval_value: readString(operations.default_schedule_interval_value, DEFAULT_WORKSPACE_SETTINGS.operations.default_schedule_interval_value),
            default_source_id: readString(operations.default_source_id, DEFAULT_WORKSPACE_SETTINGS.operations.default_source_id),
            paused_source_ids: readStringArray(operations.paused_source_ids, DEFAULT_WORKSPACE_SETTINGS.operations.paused_source_ids),
            paused_tag_ids: readStringArray(operations.paused_tag_ids, DEFAULT_WORKSPACE_SETTINGS.operations.paused_tag_ids),
        },
        preferences: {
            density: readString(preferences.density, DEFAULT_WORKSPACE_SETTINGS.preferences.density) as WorkspacePreferenceSettings["density"],
            display_currency: readString(preferences.display_currency, DEFAULT_WORKSPACE_SETTINGS.preferences.display_currency),
            display_locale: readString(preferences.display_locale, DEFAULT_WORKSPACE_SETTINGS.preferences.display_locale),
        },
        thresholds: {
            cheap_below_percent: readNumber(thresholds.cheap_below_percent, DEFAULT_WORKSPACE_SETTINGS.thresholds.cheap_below_percent),
            expensive_above_percent: readNumber(thresholds.expensive_above_percent, DEFAULT_WORKSPACE_SETTINGS.thresholds.expensive_above_percent),
        },
    };
};

export const readWorkspaceSettings = (): WorkspaceSettings => {
    if (typeof window === "undefined") {
        return DEFAULT_WORKSPACE_SETTINGS;
    }

    const raw = window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY);
    if (raw === null) {
        return DEFAULT_WORKSPACE_SETTINGS;
    }

    try {
        return normalizeWorkspaceSettings(JSON.parse(raw));
    } catch {
        return DEFAULT_WORKSPACE_SETTINGS;
    }
};

export const saveWorkspaceSettings = (settings: WorkspaceSettings): void => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(WORKSPACE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export const parseMultilineValue = (value: string): string[] => {
    return value
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter((item) => item !== "");
};

export const formatMultilineValue = (values: readonly string[]): string => {
    return values.join("\n");
};
