export const scrollToTop = (element: HTMLElement | null): void => {
    if (element === null) {
        return;
    }

    if (typeof element.scrollTo === "function") {
        element.scrollTo({ top: 0 });
        return;
    }

    element.scrollTop = 0;
};
