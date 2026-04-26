package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	authhttp "nido/server/internal/auth/transport/httpapi"
	app "nido/server/internal/engagement/application"
	engagementdomain "nido/server/internal/engagement/domain"
	platformhttp "nido/server/internal/platform/httpapi"
)

// Register binds engagement routes to the supplied mux.
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

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
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
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
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
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
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

func parseBool(raw string) bool {
	parsed, _ := strconv.ParseBool(strings.TrimSpace(raw))
	return parsed
}
