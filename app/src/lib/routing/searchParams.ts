/**
 * Reads one trimmed string query parameter.
 *
 * @param params The current URL search parameters.
 * @param key The key to read.
 * @returns The trimmed string value, or an empty string when absent.
 */
export const readStringParam = (params: URLSearchParams, key: string): string => {
    return (params.get(key) ?? "").trim();
};

/**
 * Reads one positive integer query parameter.
 *
 * @param params The current URL search parameters.
 * @param key The key to read.
 * @param fallback The fallback value used when parsing fails.
 * @returns A parsed positive integer.
 */
export const readNumberParam = (params: URLSearchParams, key: string, fallback: number): number => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") {
        return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
};

/**
 * Reads one boolean query parameter.
 *
 * @param params The current URL search parameters.
 * @param key The key to read.
 * @param fallback The fallback value used when parsing fails.
 * @returns A parsed boolean value.
 */
export const readBooleanParam = (params: URLSearchParams, key: string, fallback: boolean): boolean => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") {
        return fallback;
    }

    return raw === "true";
};

/**
 * Updates one query parameter in a mutable URLSearchParams instance.
 *
 * @param params The mutable search parameter object.
 * @param key The parameter name.
 * @param value The new value to write, or nullish to delete the key.
 */
export const writeParam = (params: URLSearchParams, key: string, value: null | number | string | undefined): void => {
    if (value === undefined || value === null || `${value}`.trim() === "") {
        params.delete(key);
        return;
    }

    params.set(key, `${value}`);
};