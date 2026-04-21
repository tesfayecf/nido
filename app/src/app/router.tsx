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
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";

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
                ],
            },
        ],
    },
]);
