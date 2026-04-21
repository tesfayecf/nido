import { useCallback, useEffect, useMemo, useState } from "react";

import { readBooleanParam, readNumberParam, readStringParam, writeParam } from "@/lib/routing/searchParams";
import { type ListingSortOrder, type PropertyFilters } from "@/features/listings/listingInsights";
import { useSearchParams } from "react-router-dom";

interface PropertyFilterDraft {
    limit: string;
    maxPrice: string;
    minPrice: string;
    onlyValue: boolean;
    q: string;
    sort: ListingSortOrder;
    sourceId: string;
}

interface UsePropertyFiltersResult {
    readonly applyDraft: () => void;
    readonly draft: PropertyFilterDraft;
    readonly filters: PropertyFilters;
    readonly resetDraft: () => void;
    readonly setDraftField: <TKey extends keyof PropertyFilterDraft>(key: TKey, value: PropertyFilterDraft[TKey]) => void;
}

const DEFAULT_LIMIT = 120;

/**
 * Manages URL-synced property filters and their editable draft state.
 *
 * The URL remains the durable source of truth so market views can be refreshed,
 * bookmarked, and shared. A lightweight local draft layer prevents the router
 * from updating on every keystroke while still keeping all applied filters in
 * search params.
 *
 * @returns The parsed active filters plus draft editing helpers.
 */
export const usePropertyFilters = (): UsePropertyFiltersResult => {
    const [searchParams, setSearchParams] = useSearchParams();
    const filters = useMemo<PropertyFilters>(() => {
        const sort = readStringParam(searchParams, "sort");
        return {
            limit: readNumberParam(searchParams, "limit", DEFAULT_LIMIT),
            maxPrice: readNullableNumberParam(searchParams, "max_price"),
            minPrice: readNullableNumberParam(searchParams, "min_price"),
            onlyValue: readBooleanParam(searchParams, "value_only", false),
            q: readStringParam(searchParams, "q"),
            sort: isListingSortOrder(sort) ? sort : "latest",
            sourceId: readStringParam(searchParams, "source_id"),
        };
    }, [searchParams]);
    const [draft, setDraft] = useState<PropertyFilterDraft>(() => toDraft(filters));

    useEffect(() => {
        setDraft(toDraft(filters));
    }, [filters]);

    const setDraftField = useCallback(<TKey extends keyof PropertyFilterDraft>(key: TKey, value: PropertyFilterDraft[TKey]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    }, []);

    const applyDraft = useCallback(() => {
        const nextParams = new URLSearchParams(searchParams);
        writeParam(nextParams, "q", draft.q);
        writeParam(nextParams, "source_id", draft.sourceId);
        writeParam(nextParams, "limit", draft.limit);
        writeParam(nextParams, "min_price", draft.minPrice);
        writeParam(nextParams, "max_price", draft.maxPrice);
        writeParam(nextParams, "sort", draft.sort === "latest" ? undefined : draft.sort);
        writeParam(nextParams, "value_only", draft.onlyValue ? "true" : undefined);
        setSearchParams(nextParams);
    }, [draft, searchParams, setSearchParams]);

    const resetDraft = useCallback(() => {
        const nextDraft = toDraft(filters);
        setDraft(nextDraft);
    }, [filters]);

    return { applyDraft, draft, filters, resetDraft, setDraftField };
};

const toDraft = (filters: PropertyFilters): PropertyFilterDraft => {
    return {
        limit: `${filters.limit}`,
        maxPrice: filters.maxPrice === null ? "" : `${filters.maxPrice}`,
        minPrice: filters.minPrice === null ? "" : `${filters.minPrice}`,
        onlyValue: filters.onlyValue,
        q: filters.q,
        sort: filters.sort,
        sourceId: filters.sourceId,
    };
};

const readNullableNumberParam = (params: URLSearchParams, key: string): number | null => {
    const raw = readStringParam(params, key);
    if (raw === "") {
        return null;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
};

const isListingSortOrder = (value: string): value is ListingSortOrder => {
    return value === "latest" || value === "price-asc" || value === "price-desc" || value === "value";
};
