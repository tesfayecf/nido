/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare namespace JSX {
    type Element = import("react").JSX.Element;
}