/**
 * Formats a numeric price into a currency string.
 *
 * @param amount The price amount in whole units.
 * @param currency The ISO-like currency code from the backend.
 * @returns A localized currency string.
 */
export const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat("en", {
        currency,
        maximumFractionDigits: 0,
        style: "currency",
    }).format(amount);
};