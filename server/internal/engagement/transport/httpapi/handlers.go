package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	authhttp "home-searcher/server/internal/auth/transport/httpapi"
	app "home-searcher/server/internal/engagement/application"
	engagementdomain "home-searcher/server/internal/engagement/domain"
	platformhttp "home-searcher/server/internal/platform/httpapi"
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
			ListingID string `json:"listing_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if err := service.CreateBookmark(r.Context(), principal.User.ID, request.ListingID); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]string{"status": "created"})
	})))

	mux.Handle("DELETE /api/v1/me/bookmarks/{listingID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		if err := service.DeleteBookmark(r.Context(), principal.User.ID, r.PathValue("listingID")); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})))

	mux.Handle("GET /api/v1/me/watchlists", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		items, err := service.ListWatchlists(r.Context(), principal.User.ID)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
	})))

	mux.Handle("POST /api/v1/me/watchlists", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		var request struct {
			Name           string `json:"name"`
			Query          string `json:"query"`
			SourceID       string `json:"source_id"`
			MaxPriceAmount *int64 `json:"max_price_amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		watchlist, err := service.CreateWatchlist(r.Context(), engagementdomain.Watchlist{
			UserID:         principal.User.ID,
			Name:           request.Name,
			Query:          request.Query,
			SourceID:       request.SourceID,
			MaxPriceAmount: request.MaxPriceAmount,
		})
		if err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusCreated, map[string]any{"item": watchlist})
	})))

	mux.Handle("DELETE /api/v1/me/watchlists/{watchlistID}", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := authhttp.CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		if err := service.DeleteWatchlist(r.Context(), principal.User.ID, r.PathValue("watchlistID")); err != nil {
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
			WatchlistID     string `json:"watchlist_id"`
			ListingID       string `json:"listing_id"`
			RuleType        string `json:"rule_type"`
			ThresholdAmount *int64 `json:"threshold_amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		rule, err := service.CreateAlertRule(r.Context(), engagementdomain.AlertRule{
			UserID:          principal.User.ID,
			WatchlistID:     request.WatchlistID,
			ListingID:       request.ListingID,
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

		items, err := service.ListNotifications(r.Context(), principal.User.ID, parseBool(r.URL.Query().Get("unread_only")), parseLimit(r.URL.Query().Get("limit")))
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
}

func parseBool(raw string) bool {
	parsed, _ := strconv.ParseBool(strings.TrimSpace(raw))
	return parsed
}

func parseLimit(raw string) int {
	if strings.TrimSpace(raw) == "" {
		return 0
	}

	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}

	return limit
}
