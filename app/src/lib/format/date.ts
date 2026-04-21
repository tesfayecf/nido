/**
 * Formats a timestamp into a dense local date and time string.
 *
 * @param value The ISO timestamp or date object to format.
 * @returns A localized date-time string.
 */
export const formatDateTime = (value: Date | string): string => {
    const date = typeof value === "string" ? new Date(value) : value;

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
};