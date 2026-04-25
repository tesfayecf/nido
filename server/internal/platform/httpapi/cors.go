package httpapi

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

const defaultCORSAllowHeaders = "Authorization, Content-Type"
const defaultCORSAllowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

// CORSMiddleware allows browser-based loopback clients to call the backend
// directly during local preview and other split-origin workflows.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		header := w.Header()
		appendVary(header, "Origin")
		appendVary(header, "Access-Control-Request-Method")
		appendVary(header, "Access-Control-Request-Headers")

		if !isLoopbackOrigin(origin) {
			next.ServeHTTP(w, r)
			return
		}

		header.Set("Access-Control-Allow-Origin", origin)
		header.Set("Access-Control-Allow-Methods", defaultCORSAllowMethods)
		header.Set("Access-Control-Allow-Headers", requestedCORSHeaders(r))
		header.Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func requestedCORSHeaders(r *http.Request) string {
	requested := strings.TrimSpace(r.Header.Get("Access-Control-Request-Headers"))
	if requested == "" {
		return defaultCORSAllowHeaders
	}

	return requested
}

func isLoopbackOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}

	host := parsed.Hostname()
	if host == "" {
		return false
	}

	if strings.EqualFold(host, "localhost") {
		return true
	}

	parsedIP := net.ParseIP(host)
	return parsedIP != nil && parsedIP.IsLoopback()
}

func appendVary(header http.Header, value string) {
	for _, existing := range header.Values("Vary") {
		for _, item := range strings.Split(existing, ",") {
			if strings.EqualFold(strings.TrimSpace(item), value) {
				return
			}
		}
	}

	header.Add("Vary", value)
}
