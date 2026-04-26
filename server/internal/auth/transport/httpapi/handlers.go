package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	app "nido/server/internal/auth/application"
	authdomain "nido/server/internal/auth/domain"
	platformhttp "nido/server/internal/platform/httpapi"
)

type principalContextKey struct{}

// Principal stores the authenticated actor attached to a request.
type Principal struct {
	User    authdomain.User
	Session authdomain.Session
}

// CurrentPrincipal returns the authenticated principal from the request context.
func CurrentPrincipal(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	return principal, ok
}

// Middleware authenticates bearer tokens and injects the principal into the request context.
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

// Register binds auth routes to the mux.
func Register(mux *http.ServeMux, service *app.Service) {
	requireAuth := Middleware(service)

	mux.HandleFunc("POST /api/v1/auth/login", func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			platformhttp.WriteError(w, http.StatusBadRequest, "invalid request body")
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
