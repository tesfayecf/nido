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
