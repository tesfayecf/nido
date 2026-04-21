import React from "react";
import ReactDOM from "react-dom/client";

import { AppProviders } from "@/app/AppProviders";
import "@/styles/globals.css";
import "@/styles/tokens.css";

const container = document.getElementById("root");

if (container === null) {
    throw new Error("Root container was not found.");
}

ReactDOM.createRoot(container).render(
    <React.StrictMode>
        <AppProviders />
    </React.StrictMode>,
);