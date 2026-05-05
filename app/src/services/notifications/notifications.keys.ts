/**
 * File: app/src/services/notifications/notifications.keys.ts
 *
 * Purpose:
 * Defines the notifications frontend API contract, request helpers, query keys, or shared service types.
 *
 * Responsibilities:
 * - Describe typed request and response boundaries
 * - Centralize API paths, query keys, or service helpers
 * - Keep backend integration details out of rendering components
 *
 * Inputs:
 * - Imports: @/services/notifications/notifications.types
 *
 * Outputs:
 * - Typed service functions, query keys, or domain types used by React Query and pages
 *
 * Dependencies:
 * - @/services/notifications/notifications.types
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
 * - /docs/frontend/architecture-overview.md#api-contracts
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
import type { NotificationFilters } from "@/services/notifications/notifications.types";

const notificationsRoot = ["me", "notifications"] as const;

/**
 * Defines stable query keys for notification data.
 */
export const notificationKeys = {
    all: (): typeof notificationsRoot => notificationsRoot,
    list: (filters: NotificationFilters) => [...notificationsRoot, filters] as const,
};
