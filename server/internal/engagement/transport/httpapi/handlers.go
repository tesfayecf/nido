/**
 * File: internal/engagement/transport/httpapi/handlers.go
 *
 * Purpose:
 * Exposes HTTP transport handlers and request/response adaptation for this backend area.
 *
 * Responsibilities:
 * - Decode and validate HTTP requests
 * - Call application services
 * - Encode stable JSON responses and errors
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - net/http
 * - strconv
 * - strings
 * - nido/server/internal/auth/transport/httpapi
 * - nido/server/internal/engagement/application
 * - nido/server/internal/engagement/domain
 * - nido/server/internal/platform/httpapi
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	authhttp "nido/server/internal/auth/transport/httpapi"
	app "nido/server/internal/engagement/application"
	engagementdomain "nido/server/internal/engagement/domain"
	platformhttp "nido/server/internal/platform/httpapi"
)

/**
 * Purpose:
 * Performs the Register operation for this backend package.
 *
 * Parameters:
 * - mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.Service
 *
 * Returns:
 * - None.
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func Register(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler, service *app.Service) {
	mux.Handle("GET /api/v1/me/bookmarks", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		items, err := service.ListBookmarks(r.Context(), principal.User.ID)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, items, nil)
	})))

	mux.Handle("POST /api/v1/me/bookmarks", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		var request struct {
			PropertyID string `json:"property_id"`
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		if err := service.CreateBookmark(r.Context(), principal.User.ID, request.PropertyID); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]string{"status": "created"})
	})))

	mux.Handle("DELETE /api/v1/me/bookmarks/{propertyID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		if err := service.DeleteBookmark(r.Context(), principal.User.ID, r.PathValue("propertyID")); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.Handle("GET /api/v1/me/alert-rules", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		items, err := service.ListAlertRules(r.Context(), principal.User.ID)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, items, nil)
	})))

	mux.Handle("POST /api/v1/me/alert-rules", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		var request struct {
			PropertyID      string `json:"property_id"`
			RuleType        string `json:"rule_type"`
			ThresholdAmount *int64 `json:"threshold_amount"`
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		rule, err := service.CreateAlertRule(r.Context(), engagementdomain.AlertRule{
			UserID:          principal.User.ID,
			PropertyID:      request.PropertyID,
			RuleType:        request.RuleType,
			ThresholdAmount: request.ThresholdAmount,
		})
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": rule})
	})))

	mux.Handle("PUT /api/v1/me/alert-rules/{ruleID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		var request struct {
			Enabled bool `json:"enabled"`
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		if err := service.SetAlertRuleEnabled(r.Context(), principal.User.ID, r.PathValue("ruleID"), request.Enabled); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	})))

	mux.Handle("DELETE /api/v1/me/alert-rules/{ruleID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		if err := service.DeleteAlertRule(r.Context(), principal.User.ID, r.PathValue("ruleID")); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.Handle("GET /api/v1/me/notifications", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		items, err := service.ListNotifications(r.Context(), principal.User.ID, parseBool(r.URL.Query().Get("unread_only")), platformhttp.ParseLimit(r.URL.Query().Get("limit")))
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WritePaginatedJSON(w, r, http.StatusOK, items, nil)
	})))

	mux.Handle("POST /api/v1/me/notifications/{notificationID}/read", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		if err := service.MarkNotificationRead(r.Context(), principal.User.ID, r.PathValue("notificationID")); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "read"})
	})))

	mux.Handle("POST /api/v1/me/notifications/{notificationID}/unread", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		if err := service.MarkNotificationUnread(r.Context(), principal.User.ID, r.PathValue("notificationID")); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "unread"})
	})))
}

/**
 * Purpose:
 * Performs the parseBool operation for this backend package.
 *
 * Parameters:
 * - raw string
 *
 * Returns:
 * - bool
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func parseBool(raw string) bool {
	parsed, _ := strconv.ParseBool(strings.TrimSpace(raw))
	return parsed
}
