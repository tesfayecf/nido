/**
 * Reads one non-negative number, falling back when parsing fails.
 *
 * @param value The raw form value.
 * @param fallback The fallback used when the value is invalid.
 * @returns A valid non-negative number.
 */
export const readNonNegativeNumber = (value: string, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }

    return parsed;
};

/**
 * Parses an optional non-negative integer from form input.
 *
 * @param value The raw form value.
 * @returns A safe non-negative integer, or undefined when the value is blank or invalid.
 */
export const parseOptionalNonNegativeInteger = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (trimmed === "") {
        return undefined;
    }

    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        return undefined;
    }

    return parsed;
};