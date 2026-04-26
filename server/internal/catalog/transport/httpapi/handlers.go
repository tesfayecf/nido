package httpapi

import (
	"errors"
	"net/http"
	"strings"

	app "nido/server/internal/catalog/application"
	"nido/server/internal/catalog/domain"
	platformhttp "nido/server/internal/platform/httpapi"
)

// Register binds catalog HTTP routes to the supplied mux.
func Register(mux *http.ServeMux, service *app.Service) {
	mux.HandleFunc("GET /api/v1/listings", func(w http.ResponseWriter, r *http.Request) {
		query := domain.ListQuery{
			Query:    strings.TrimSpace(r.URL.Query().Get("q")),
			SourceID: strings.TrimSpace(r.URL.Query().Get("source_id")),
			Limit:    platformhttp.ParseLimit(r.URL.Query().Get("limit")),
		}

		items, err := service.List(r.Context(), query)
		if err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"items": items,
			"count": len(items),
		})
	})

	mux.HandleFunc("GET /api/v1/listings/{listingID}", func(w http.ResponseWriter, r *http.Request) {
		listingID := strings.TrimSpace(r.PathValue("listingID"))
		if listingID == "" {
			platformhttp.WriteError(w, http.StatusBadRequest, "listing id is required")
			return
		}

		detail, err := service.Get(r.Context(), listingID)
		if err != nil {
			if errors.Is(err, app.ErrNotFound) {
				platformhttp.WriteError(w, http.StatusNotFound, err.Error())
				return
			}

			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"item":          detail.Listing,
			"price_history": detail.PriceHistory,
		})
	})
}
