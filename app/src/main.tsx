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
