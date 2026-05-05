/**
 * File: internal/auth/transport/httpapi/handlers.go
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
 * - context
 * - net/http
 * - strings
 * - nido/server/internal/auth/application
 * - nido/server/internal/auth/domain
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
	"context"
	"net/http"
	"strings"

	app "nido/server/internal/auth/application"
	authdomain "nido/server/internal/auth/domain"
	platformhttp "nido/server/internal/platform/httpapi"
)

/**
 * Purpose:
 * Defines the principalContextKey struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type principalContextKey struct{}

/**
 * Purpose:
 * Defines the Principal struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type Principal struct {
	User    authdomain.User
	Session authdomain.Session
}

/**
 * Purpose:
 * Performs the CurrentPrincipal operation for this backend package.
 *
 * Parameters:
 * - ctx context.Context
 *
 * Returns:
 * - (Principal, bool)
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
func CurrentPrincipal(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	return principal, ok
}

/**
 * Purpose:
 * Performs the Middleware operation for this backend package.
 *
 * Parameters:
 * - service *app.Service
 *
 * Returns:
 * - func(http.Handler) http.Handler
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
func Middleware(service *app.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractBearerToken(r.Header.Get("Authorization"))
			user, session, err := service.AuthenticateToken(r.Context(), token)
			if err != nil {
				platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			ctx := context.WithValue(r.Context(), principalContextKey{}, Principal{User: user, Session: session})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

/**
 * Purpose:
 * Performs the Register operation for this backend package.
 *
 * Parameters:
 * - mux *http.ServeMux, service *app.Service
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
func Register(mux *http.ServeMux, service *app.Service) {
	requireAuth := Middleware(service)

	mux.HandleFunc("POST /api/v1/auth/login", func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}

		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		user, session, token, err := service.Login(r.Context(), request.Email, request.Password)
		if err != nil {
			platformhttp.WriteError(w, http.StatusUnauthorized, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{
			"token":      token,
			"user":       user,
			"expires_at": session.ExpiresAt,
		})
	})

	mux.Handle("GET /api/v1/auth/me", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"user": principal.User})
	})))

	mux.Handle("POST /api/v1/auth/logout", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		if err := service.Logout(r.Context(), principal.Session.ID); err != nil {
			platformhttp.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})))

	mux.Handle("PUT /api/v1/auth/me", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		var request struct {
			DisplayName string `json:"display_name"`
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		updated, err := service.UpdateProfile(r.Context(), principal.User.ID, request.DisplayName)
		if err != nil {
			if err == app.ErrInvalidProfile {
				platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
				return
			}
			platformhttp.WriteError(w, http.StatusInternalServerError, "could not update profile")
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]any{"item": updated})
	})))

	mux.Handle("POST /api/v1/auth/me/password", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := CurrentPrincipal(r.Context())
		if !ok {
			platformhttp.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		var request struct {
			CurrentPassword string `json:"current_password"`
			NewPassword     string `json:"new_password"`
		}
		if !platformhttp.DecodeJSON(w, r, &request) {
			return
		}

		if err := service.ChangePassword(r.Context(), principal.User.ID, request.CurrentPassword, request.NewPassword); err != nil {
			switch err {
			case app.ErrInvalidPassword:
				platformhttp.WriteError(w, http.StatusUnauthorized, err.Error())
			case app.ErrPasswordTooWeak:
				platformhttp.WriteError(w, http.StatusBadRequest, err.Error())
			default:
				platformhttp.WriteError(w, http.StatusInternalServerError, "could not change password")
			}
			return
		}

		platformhttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})))
}

/**
 * Purpose:
 * Performs the extractBearerToken operation for this backend package.
 *
 * Parameters:
 * - header string
 *
 * Returns:
 * - string
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
func extractBearerToken(header string) string {
	value := strings.TrimSpace(header)
	if value == "" {
		return ""
	}

	const prefix = "Bearer "
	if strings.HasPrefix(strings.ToLower(value), strings.ToLower(prefix)) {
		return strings.TrimSpace(value[len(prefix):])
	}

	return value
}
