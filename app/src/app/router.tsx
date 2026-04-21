import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppRouteError } from "@/app/AppRouteError";
import { AppShell } from "@/app/AppShell";
import { RequireAuth } from "@/app/RequireAuth";
import { AlertsPage } from "@/features/engagement/AlertsPage";
import { BookmarksPage } from "@/features/engagement/BookmarksPage";
import { NotificationsPage } from "@/features/engagement/NotificationsPage";
import { WatchlistsPage } from "@/features/engagement/WatchlistsPage";
import { SourceDetailPage } from "@/features/backoffice/SourceDetailPage";
import { SourcesPage } from "@/features/backoffice/SourcesPage";
import { RunDetailPage } from "@/features/backoffice/RunDetailPage";
import { RunsPage } from "@/features/backoffice/RunsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ListingDetailPage } from "@/features/listings/ListingDetailPage";
import { ListingsPage } from "@/features/listings/ListingsPage";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";

/**
 * Defines the top-level route tree for the application.
 *
 * Listing exploration remains public in iteration 1. Personal and backoffice
 * workflows are explicitly protected.
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
                element: <Navigate replace to={"/listings"} />,
            },
            {
                path: "listings",
                element: <ListingsPage />,
            },
            {
                path: "listings/:listingId",
                element: <ListingDetailPage />,
            },
            {
                element: <RequireAuth />,
                children: [
                    {
                        path: "bookmarks",
                        element: <BookmarksPage />,
                    },
                    {
                        path: "watchlists",
                        element: <WatchlistsPage />,
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
                        path: "backoffice/sources",
                        element: <SourcesPage />,
                    },
                    {
                        path: "backoffice/sources/new",
                        element: <SourceDetailPage />,
                    },
                    {
                        path: "backoffice/sources/:sourceId",
                        element: <SourceDetailPage />,
                    },
                    {
                        path: "backoffice/runs",
                        element: <RunsPage />,
                    },
                    {
                        path: "backoffice/runs/:runId",
                        element: <RunDetailPage />,
                    },
                ],
            },
        ],
    },
]);
