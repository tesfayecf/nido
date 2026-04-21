package httpapi

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse is the common JSON error shape for the HTTP API.
type ErrorResponse struct {
	Error string `json:"error"`
}

// WriteJSON writes a JSON response with the supplied status code.
func WriteJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

// WriteError writes a JSON error payload.
func WriteError(w http.ResponseWriter, statusCode int, message string) {
	WriteJSON(w, statusCode, ErrorResponse{Error: message})
}
