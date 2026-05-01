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
