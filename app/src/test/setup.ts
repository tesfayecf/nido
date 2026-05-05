/**
 * File: app/src/test/setup.ts
 *
 * Purpose:
 * Defines the frontend behavior owned by test/setup.ts.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Module imports, constants, browser APIs, or caller-provided parameters as declared below
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - TypeScript compiler
 * - Vite module graph
 *
 * Key Decisions:
 * - Keeps documentation adjacent to the implementation so future changes update behavior and context together.
 * - Uses explicit imports and typed boundaries to make ownership traceable from this file in isolation.
 *
 * Constraints:
 * - Documentation must remain synchronized with behavior, tests, and related docs when this file changes.
 * - Runtime behavior must not depend on comments or documentation-only metadata.
 *
 * Related:
 * - /docs/frontend/documentation-template.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
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
