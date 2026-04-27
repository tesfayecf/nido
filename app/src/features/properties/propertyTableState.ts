export interface NumericRangeFilter {
    readonly max: string;
    readonly min: string;
}

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

export const createDefaultPropertiesTableState = (columnIds: readonly string[]): PropertiesTableState => ({
    filters: DEFAULT_PROPERTIES_TABLE_FILTERS,
    hiddenColumnIds: [],
    orderedColumnIds: [...columnIds],
    widths: {},
});

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
        return createDefaultPropertiesTableState(columnIds);
    }
};

export const writePropertiesTableState = (storageKey: string, state: PropertiesTableState): void => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(state));
};
