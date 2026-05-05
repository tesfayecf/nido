/**
 * File: app/src/app/router.tsx
 *
 * Purpose:
 * Declares the browser route tree, authentication boundary, and page-to-path mapping for the frontend application.
 *
 * Responsibilities:
 * - Render accessible React UI for the owning workflow
 * - Coordinate props, hooks, and service data without leaking implementation details
 * - Expose predictable outputs for tests and consuming components
 *
 * Inputs:
 * - Imports: react-router-dom, @/app/AppRouteError, @/app/AppShell, @/app/RequireAuth, @/features/backoffice/SourceDetailPage, @/features/backoffice/SourcesPage, @/features/backoffice/RunDetailPage, @/features/backoffice/RunsPage; additional imports omitted for brevity
 *
 * Outputs:
 * - JSX elements, React context, or route definitions rendered by consuming modules
 *
 * Dependencies:
 * - react-router-dom
 * - @/app/AppRouteError
 * - @/app/AppShell
 * - @/app/RequireAuth
 * - @/features/backoffice/SourceDetailPage
 * - @/features/backoffice/SourcesPage
 * - @/features/backoffice/RunDetailPage
 * - @/features/backoffice/RunsPage
 * - @/features/auth/LoginPage
 * - @/features/engagement/AlertsPage
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
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppRouteError } from "@/app/AppRouteError";
import { AppShell } from "@/app/AppShell";
import { RequireAuth } from "@/app/RequireAuth";
import { SourceDetailPage } from "@/features/backoffice/SourceDetailPage";
import { SourcesPage } from "@/features/backoffice/SourcesPage";
import { RunDetailPage } from "@/features/backoffice/RunDetailPage";
import { RunsPage } from "@/features/backoffice/RunsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { AlertsPage } from "@/features/engagement/AlertsPage";
import { BookmarksPage } from "@/features/engagement/BookmarksPage";
import { NotificationsPage } from "@/features/engagement/NotificationsPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { FieldAnalyticsPage } from "@/features/fields/FieldAnalyticsPage";
import { FieldsPage } from "@/features/fields/FieldsPage";
import { DashboardPage } from "@/features/operators/DashboardPage";
import { TriageInboxPage } from "@/features/operators/TriageInboxPage";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import { PropertyComparePage } from "@/features/properties/PropertyComparePage";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";
import { PropertyPrintPage } from "@/features/properties/PropertyPrintPage";
import { FieldAnalysisPage } from "@/features/properties/FieldAnalysisPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TagsPage } from "@/features/tags/TagsPage";

/**
 * Documents the router module export for app/src/app/router.tsx.
 * Consumers should treat this export as part of the file contract and update related docs when behavior changes.
 */
export const router = createBrowserRouter([
    {
        path: "/login",
        element: <LoginPage />,
        errorElement: <AppRouteError />,
    },
    {
        path: "/",
        element: <AppShell />,
        errorElement: <AppRouteError />,
        children: [
            {
                index: true,
                element: <Navigate replace to={"/dashboard"} />,
            },
            {
                element: <RequireAuth />,
                /*
                 * Critical point: every route in this branch assumes an authenticated operator and may issue
                 * bearer-token API calls through service modules. Moving routes outside this boundary would expose
                 * protected workflows before session validation and break the documented auth data flow.
                 */
                children: [
                    {
                        path: "dashboard",
                        element: <DashboardPage />,
                    },
                    {
                        path: "analytics",
                        element: <AnalyticsPage />,
                    },
                    {
                        path: "triage",
                        element: <TriageInboxPage />,
                    },
                    {
                        path: "properties",
                        element: <PropertiesPage />,
                    },
                    {
                        path: "properties/new",
                        element: <PropertyDetailPage />,
                    },
                    {
                        path: "properties/compare",
                        element: <PropertyComparePage />,
                    },
                    {
                        path: "properties/print",
                        element: <PropertyPrintPage />,
                    },
                    {
                        path: "properties/:propertyId",
                        element: <PropertyDetailPage />,
                    },
                    {
                        path: "properties/:propertyId/print",
                        element: <PropertyPrintPage />,
                    },
                    {
                        path: "properties/:propertyId/fields/:fieldName/analysis",
                        element: <FieldAnalysisPage />,
                    },
                    {
                        path: "fields",
                        element: <FieldsPage />,
                    },
                    {
                        path: "fields/:fieldName/analytics",
                        element: <FieldAnalyticsPage />,
                    },
                    {
                        path: "sources",
                        element: <SourcesPage />,
                    },
                    {
                        path: "sources/new",
                        element: <SourceDetailPage />,
                    },
                    {
                        path: "sources/:sourceId",
                        element: <SourceDetailPage />,
                    },
                    {
                        path: "runs",
                        element: <RunsPage />,
                    },
                    {
                        path: "runs/:runId",
                        element: <RunDetailPage />,
                    },
                    {
                        path: "tags",
                        element: <TagsPage />,
                    },
                    {
                        path: "bookmarks",
                        element: <BookmarksPage />,
                    },
                    {
                        path: "alerts",
                        element: <AlertsPage />,
                    },
                    {
                        path: "notifications",
                        element: <NotificationsPage />,
                    },
                    {
                        path: "settings",
                        element: <SettingsPage />,
                    },
                ],
            },
        ],
    },
]);
