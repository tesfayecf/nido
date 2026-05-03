export const readSessionStorageNumber = (key: string | undefined, fallback: number, options?: { readonly allowZero?: boolean; }): number => {
    const storedValue = key === undefined ? null : sessionStorage.getItem(key);
    const parsedValue = storedValue === null ? fallback : Number(storedValue);
    const isAllowed = options?.allowZero === true ? parsedValue >= 0 : parsedValue > 0;

    return Number.isInteger(parsedValue) && isAllowed ? parsedValue : fallback;
};
