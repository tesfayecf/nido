/**
 * File: app/src/features/properties/propertyExport.ts
 *
 * Purpose:
 * Implements the properties feature workflow, including page rendering, user interactions, and frontend data coordination.
 *
 * Responsibilities:
 * - Define typed frontend behavior for its module boundary
 * - Keep inputs and outputs explicit for maintainability
 * - Reference related modules so changes can be traced safely
 *
 * Inputs:
 * - Imports: @/services/properties/properties.types
 *
 * Outputs:
 * - Typed constants, functions, or side effects explicitly exported by this module
 *
 * Dependencies:
 * - @/services/properties/properties.types
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
 * - /app/docs/features/properties.md
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import type { Property, PropertySnapshot } from "@/services/properties/properties.types";

interface ExportPayload {
    readonly content: string;
    readonly fileName: string;
    readonly mimeType: string;
}

/**
 * Documents the PropertyListExportColumn type contract used by app/src/features/properties/propertyExport.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyListExportColumn {
    readonly header: string;
    readonly id: string;
}

/**
 * Documents the PropertyListExportRow type contract used by app/src/features/properties/propertyExport.ts.
 * Fields are intentionally explicit so callers understand the accepted shape without reading downstream consumers.
 */
export interface PropertyListExportRow {
    readonly [key: string]: string | number | undefined;
    readonly id: string;
    readonly url: string;
}

const escapeCSVCell = (value: string | number | undefined): string => {
    const normalized = value === undefined ? "" : `${value}`;
    return /[",\n]/u.test(normalized) ? `"${normalized.replace(/"/gu, "\"\"")}"` : normalized;
};

const downloadText = ({ content, fileName, mimeType }: ExportPayload): void => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
};

/**
 * Purpose: Executes the downloadPropertyListExport operation for app/src/features/properties/propertyExport.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const downloadPropertyListExport = (
    rows: readonly PropertyListExportRow[],
    columns: readonly PropertyListExportColumn[],
    format: "csv" | "json",
): void => {
    if (format === "json") {
        downloadText({
            content: JSON.stringify(rows, null, 2),
            fileName: "nido-properties.json",
            mimeType: "application/json",
        });
        return;
    }

    const headers = ["id", ...columns.map((column) => column.id), "url"];
    const csv = [
        ["id", ...columns.map((column) => column.header), "URL"].join(","),
        ...rows.map((row) => headers.map((header) => escapeCSVCell(row[header])).join(",")),
    ].join("\n");

    downloadText({
        content: csv,
        fileName: "nido-properties.csv",
        mimeType: "text/csv;charset=utf-8",
    });
};

/**
 * Purpose: Executes the downloadPropertySnapshotExport operation for app/src/features/properties/propertyExport.ts.
 * Parameters: Accepts the typed arguments declared in the function signature and expects callers to satisfy those contracts.
 * Returns: Produces the typed return value declared in the signature without hidden mutation unless noted inline.
 * Side effects: Any network, storage, routing, or DOM effects are kept explicit in the function body.
 * Edge cases: Handles absent, malformed, or boundary inputs where the implementation below documents those branches.
 */
export const downloadPropertySnapshotExport = (
    property: Property,
    snapshots: readonly PropertySnapshot[],
    format: "csv" | "json",
): void => {
    const fieldNames = Array.from(new Set(snapshots.flatMap((snapshot) => Object.keys(snapshot.values)))).sort((left, right) => left.localeCompare(right));
    const fileBase = (property.label.trim() || property.id).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
    if (format === "json") {
        downloadText({
            content: JSON.stringify({
                property,
                snapshots,
            }, null, 2),
            fileName: `${fileBase || "property"}-snapshots.json`,
            mimeType: "application/json",
        });
        return;
    }

    const headers = ["id", "observed_at", "config_version", "is_valid", "error_message", ...fieldNames];
    const csv = [
        ["Snapshot ID", "Observed at", "Config version", "Valid", "Error", ...fieldNames].join(","),
        ...snapshots.map((snapshot) => headers.map((header) => {
            switch (header) {
                case "id":
                    return escapeCSVCell(snapshot.id);
                case "observed_at":
                    return escapeCSVCell(snapshot.observed_at);
                case "config_version":
                    return escapeCSVCell(snapshot.config_version);
                case "is_valid":
                    return escapeCSVCell(snapshot.is_valid ? "true" : "false");
                case "error_message":
                    return escapeCSVCell(snapshot.error_message);
                default:
                    return escapeCSVCell(snapshot.values[header]);
            }
        }).join(",")),
    ].join("\n");

    downloadText({
        content: csv,
        fileName: `${fileBase || "property"}-snapshots.csv`,
        mimeType: "text/csv;charset=utf-8",
    });
};
