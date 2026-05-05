/**
 * File: app/src/main.tsx
 *
 * Purpose:
 * Bootstraps the React application, global styles, and router provider into the browser document.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react, react-dom/client, @/app/AppProviders, @/hooks/useTheme
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react
 * - react-dom/client
 * - @/app/AppProviders
 * - @/hooks/useTheme
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
import React from "react";
import ReactDOM from "react-dom/client";

import { AppProviders } from "@/app/AppProviders";
import { applyThemePreference, getStoredThemePreference } from "@/hooks/useTheme";
import "@/styles/main.scss";

const container = document.getElementById("root");

if (container === null) {
    throw new Error("Root container was not found.");
}

applyThemePreference(getStoredThemePreference());

ReactDOM.createRoot(container).render(
    <React.StrictMode>
        <AppProviders />
    </React.StrictMode>,
);
