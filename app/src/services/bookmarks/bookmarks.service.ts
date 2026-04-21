import { apiRequest, type ListEnvelope, type StatusEnvelope } from "@/lib/api/client";

import type { BookmarkedProperty } from "@/services/bookmarks/bookmarks.types";

export const listBookmarks = async (): Promise<BookmarkedProperty[]> => {
    const response = await apiRequest<ListEnvelope<BookmarkedProperty>>({
        auth: true,
        path: "/api/v1/me/bookmarks",
    });

    return response.items;
};

export const createBookmark = async (propertyId: string): Promise<void> => {
    await apiRequest<StatusEnvelope, { property_id: string; }>({
        auth: true,
        body: { property_id: propertyId },
        method: "POST",
        path: "/api/v1/me/bookmarks",
    });
};

export const deleteBookmark = async (propertyId: string): Promise<void> => {
    await apiRequest<StatusEnvelope>({
        auth: true,
        method: "DELETE",
        path: `/api/v1/me/bookmarks/${propertyId}`,
    });
};
