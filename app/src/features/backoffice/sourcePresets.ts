import type { Source } from "@/services/backoffice-sources/sources.types";

export type SourcePresetId =
    | "generic-json-feed"
    | "generic-html-listings"
    | "idealista-search"
    | "fotocasa-search"
    | "habitaclia-search";

interface SourcePresetDefaults {
    readonly browser_enabled: boolean;
    readonly freshness_window_seconds?: number;
    readonly kind: string;
    readonly rate_limit_max_requests?: number;
    readonly rate_limit_window_seconds?: number;
    readonly retry_backoff_millis?: number;
    readonly retry_max_attempts?: number;
    readonly schedule_interval_seconds?: number;
}

export interface SourcePreset {
    readonly config_json: string;
    readonly description: string;
    readonly id: SourcePresetId;
    readonly label: string;
    readonly sourceDefaults: SourcePresetDefaults;
}

export const SOURCE_KIND_OPTIONS = ["http-json-feed", "html-listings", "html-jsonld"] as const;

export const DEFAULT_SOURCE_PRESET_ID: SourcePresetId = "generic-json-feed";

const createConfigJson = (config: Record<string, string>): string => {
    return JSON.stringify(config, null, 2);
};

const createHtmlListingsConfig = (overrides: Partial<Record<string, string>> = {}): string => {
    return createConfigJson({
        "base_url": "",
        "currency": "",
        "external_id_attribute": "",
        "item_selector": "",
        "location_selector": "",
        "price_selector": "",
        "title_selector": "",
        "url_selector": "",
        ...overrides,
    });
};

const defaultSourcePreset: SourcePreset = {
    config_json: createConfigJson({}),
    description: "Use this for structured listing feeds that already return JSON without browser rendering.",
    id: "generic-json-feed",
    label: "Generic JSON feed",
    sourceDefaults: {
        browser_enabled: false,
        kind: "http-json-feed",
    },
};

export const SOURCE_PRESETS: readonly SourcePreset[] = [
    defaultSourcePreset,
    {
        config_json: createHtmlListingsConfig(),
        description: "Use this for rendered listing pages where you will provide CSS selectors for the page structure.",
        id: "generic-html-listings",
        label: "Generic HTML listings page",
        sourceDefaults: {
            browser_enabled: true,
            kind: "html-listings",
        },
    },
    {
        config_json: createHtmlListingsConfig({
            "base_url": "https://www.idealista.com",
            "currency": "EUR",
            "external_id_attribute": "data-element-id",
            "item_selector": "article.item",
            "price_selector": ".item-price",
            "title_selector": "a.item-link",
            "url_selector": "a.item-link",
        }),
        description: "Starter selectors for Idealista search result pages. Review them if the site markup changes.",
        id: "idealista-search",
        label: "Idealista search",
        sourceDefaults: {
            browser_enabled: true,
            kind: "html-listings",
        },
    },
    {
        config_json: createHtmlListingsConfig({
            "base_url": "https://www.fotocasa.es",
            "currency": "EUR",
            "item_selector": "article[class*='@container']",
            "location_selector": "p.text-body-1",
            "price_selector": "div.flex.items-center.gap-mdp.text-display-3",
            "title_selector": "h3 a[href*='/es/comprar/vivienda/']",
            "url_selector": "h3 a[href*='/es/comprar/vivienda/']",
        }),
        description: "Starter selectors for Fotocasa search result pages, including title, price, URL, and location extraction.",
        id: "fotocasa-search",
        label: "Fotocasa search",
        sourceDefaults: {
            browser_enabled: true,
            kind: "html-listings",
        },
    },
    {
        config_json: createHtmlListingsConfig({
            "base_url": "https://www.habitaclia.com",
            "currency": "EUR",
            "external_id_attribute": "data-id",
            "item_selector": "article.js-list-item",
            "location_selector": ".list-item-location",
            "price_selector": ".list-item-price",
            "title_selector": ".list-item-title a[href*='/comprar-']",
            "url_selector": ".list-item-title a[href*='/comprar-']",
        }),
        description: "Starter selectors for Habitaclia result pages, including location extraction and data-id external ids.",
        id: "habitaclia-search",
        label: "Habitaclia search",
        sourceDefaults: {
            browser_enabled: true,
            kind: "html-listings",
        },
    },
];

export const getSourcePreset = (presetId: SourcePresetId): SourcePreset => {
    return SOURCE_PRESETS.find((preset) => preset.id === presetId) ?? defaultSourcePreset;
};

export const applySourcePreset = (source: Source, presetId: SourcePresetId): Source => {
    const preset = getSourcePreset(presetId);

    return {
        ...source,
        ...preset.sourceDefaults,
        config_json: preset.config_json,
    };
};