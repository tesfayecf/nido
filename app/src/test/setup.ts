import "@testing-library/jest-dom/vitest";

if (window.Request !== undefined) {
    globalThis.Request = window.Request;
}

if (window.Response !== undefined) {
    globalThis.Response = window.Response;
}

if (window.Headers !== undefined) {
    globalThis.Headers = window.Headers;
}

globalThis.AbortController = window.AbortController;
globalThis.AbortSignal = window.AbortSignal;

if (window.HTMLCanvasElement !== undefined) {
    window.HTMLCanvasElement.prototype.getContext = (() => ({
        canvas: document.createElement("canvas"),
        clearRect: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        getImageData: () => ({ data: [] }),
        measureText: () => ({ width: 0 }),
        putImageData: () => {},
        resetTransform: () => {},
        restore: () => {},
        save: () => {},
        scale: () => {},
        setLineDash: () => {},
        strokeRect: () => {},
        textAlign: "left",
        textBaseline: "alphabetic",
        translate: () => {},
    })) as typeof HTMLCanvasElement.prototype.getContext;
}

if (window.ResizeObserver === undefined) {
    class ResizeObserverMock {
        disconnect(): void {}
        observe(): void {}
        unobserve(): void {}
    }

    globalThis.ResizeObserver = ResizeObserverMock;
}
