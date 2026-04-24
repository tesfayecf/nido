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

const noop = (): void => {
    return undefined;
};

if (window.HTMLCanvasElement !== undefined) {
    const canvasContextStub = {
        canvas: document.createElement("canvas"),
        clearRect: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        fillRect: noop,
        getImageData: () => ({ data: [] }),
        measureText: () => ({ width: 0 }),
        putImageData: noop,
        resetTransform: noop,
        restore: noop,
        save: noop,
        scale: noop,
        setLineDash: noop,
        strokeRect: noop,
        textAlign: "left",
        textBaseline: "alphabetic",
        translate: noop,
    } as unknown as CanvasRenderingContext2D;

    window.HTMLCanvasElement.prototype.getContext = (() => canvasContextStub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

if (window.ResizeObserver === undefined) {
    class ResizeObserverMock {
        disconnect = noop;
        observe = noop;
        unobserve = noop;
    }

    globalThis.ResizeObserver = ResizeObserverMock;
}
