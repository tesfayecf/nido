/**
 * File: app/src/features/properties/propertyTableState.ts
 *
 * Purpose:
 * Implements the properties feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
export interface NumericRangeFilter {
    readonly max: string;
    readonly min: string;
}

/**
 * Documents the PropertiesTableFilters type contract used by app/src/features/properties/propertyTableState.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertiesTableFilters {
    readonly bathrooms: string;
    readonly location: string;
    readonly opportunity: string;
    readonly price: NumericRangeFilter;
    readonly pricePerSquareMeter: NumericRangeFilter;
    readonly property: string;
    readonly propertyAge: NumericRangeFilter;
    readonly rooms: string;
    readonly sizeSquareMeters: NumericRangeFilter;
    readonly status: string;
}

/**
 * Documents the PropertiesTableState type contract used by app/src/features/properties/propertyTableState.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertiesTableState {
    readonly filters: PropertiesTableFilters;
    readonly hiddenColumnIds: readonly string[];
    readonly orderedColumnIds: readonly string[];
    readonly widths: Record<string, number>;
}

export const DEFAULT_PROPERTIES_TABLE_FILTERS: PropertiesTableFilters = {
    bathrooms: "",
    location: "",
    opportunity: "",
    price: { max: "", min: "" },
    pricePerSquareMeter: { max: "", min: "" },
    property: "",
    propertyAge: { max: "", min: "" },
    rooms: "",
    sizeSquareMeters: { max: "", min: "" },
    status: "",
};

/**
 * Purpose: Executes the createDefaultPropertiesTableState operation for app/src/features/properties/propertyTableState.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const createDefaultPropertiesTableState = (columnIds: readonly string[]): PropertiesTableState => ({
    filters: DEFAULT_PROPERTIES_TABLE_FILTERS,
    hiddenColumnIds: [],
    orderedColumnIds: [...columnIds],
    widths: {},
});

/**
 * Purpose: Executes the readPropertiesTableState operation for app/src/features/properties/propertyTableState.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const readPropertiesTableState = (
    storageKey: string,
    columnIds: readonly string[],
): PropertiesTableState => {
    if (typeof window === "undefined") {
        return createDefaultPropertiesTableState(columnIds);
    }

    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
        return createDefaultPropertiesTableState(columnIds);
    }

    try {
        const parsed = JSON.parse(raw) as Partial<PropertiesTableState>;
        /*
         * Critical point: persisted table state is reconciled against the current column list before use.
         * Without this filter, removed or renamed columns from older releases could reappear in ordering,
         * hidden-column, or width state and corrupt the visible table layout.
         */
        const visibleColumnIds = new Set(columnIds);
        const orderedColumnIds = (parsed.orderedColumnIds ?? []).filter((columnId): columnId is string => visibleColumnIds.has(columnId));
        const missingColumnIds = columnIds.filter((columnId) => !orderedColumnIds.includes(columnId));

        return {
            filters: {
                ...DEFAULT_PROPERTIES_TABLE_FILTERS,
                ...parsed.filters,
                price: { ...DEFAULT_PROPERTIES_TABLE_FILTERS.price, ...parsed.filters?.price },
                pricePerSquareMeter: { ...DEFAULT_PROPERTIES_TABLE_FILTERS.pricePerSquareMeter, ...parsed.filters?.pricePerSquareMeter },
                propertyAge: { ...DEFAULT_PROPERTIES_TABLE_FILTERS.propertyAge, ...parsed.filters?.propertyAge },
                sizeSquareMeters: { ...DEFAULT_PROPERTIES_TABLE_FILTERS.sizeSquareMeters, ...parsed.filters?.sizeSquareMeters },
            },
            hiddenColumnIds: (parsed.hiddenColumnIds ?? []).filter((columnId): columnId is string => visibleColumnIds.has(columnId)),
            orderedColumnIds: [...orderedColumnIds, ...missingColumnIds],
            widths: Object.fromEntries(Object.entries(parsed.widths ?? {}).filter(([columnId, width]) => visibleColumnIds.has(columnId) && typeof width === "number")),
        };
    } catch {
        /*
         * Critical point: malformed localStorage data falls back to defaults instead of bubbling a parse error.
         * Throwing here would prevent the properties page from rendering for users with stale browser state.
         */
        return createDefaultPropertiesTableState(columnIds);
    }
};

/**
 * Purpose: Executes the writePropertiesTableState operation for app/src/features/properties/propertyTableState.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const writePropertiesTableState = (storageKey: string, state: PropertiesTableState): void => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(state));
};
