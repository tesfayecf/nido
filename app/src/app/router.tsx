import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppRouteError } from "@/app/AppRouteError";
import { AppShell } from "@/app/AppShell";
import { RequireAuth } from "@/app/RequireAuth";
import { SourceDetailPage } from "@/features/backoffice/SourceDetailPage";
import { EventsPage } from "@/features/backoffice/EventsPage";
import { SourcesPage } from "@/features/backoffice/SourcesPage";
import { RunDetailPage } from "@/features/backoffice/RunDetailPage";
import { RunsPage } from "@/features/backoffice/RunsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { AlertsPage } from "@/features/engagement/AlertsPage";
import { BookmarksPage } from "@/features/engagement/BookmarksPage";
import { NotificationsPage } from "@/features/engagement/NotificationsPage";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";
import { FieldAnalysisPage } from "@/features/properties/FieldAnalysisPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

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
                element: <Navigate replace to={"/properties"} />,
            },
            {
                element: <RequireAuth />,
                children: [
                    {
                        path: "properties",
                        element: <PropertiesPage />,
                    },
                    {
                        path: "properties/new",
                        element: <PropertyDetailPage />,
                    },
                    {
                        path: "properties/:propertyId",
                        element: <PropertyDetailPage />,
                    },
                    {
                        path: "properties/:propertyId/fields/:fieldName/analysis",
                        element: <FieldAnalysisPage />,
                    },
                    {
                        path: "events",
                        element: <EventsPage />,
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
