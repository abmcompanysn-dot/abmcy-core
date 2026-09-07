package response

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/abmcy/core/pkg/apierror"
)

func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Error("response: encode failed", "error", err)
	}
}

// Err writes any error as the uniform {"error": {...}} envelope.
// Non-*apierror.Error values are mapped to a generic 500 so internal
// details never leak to API clients.
func Err(w http.ResponseWriter, err error) {
	apiErr, ok := err.(*apierror.Error)
	if !ok {
		slog.Error("response: unhandled error", "error", err)
		apiErr = apierror.ErrInternal
	}
	JSON(w, apiErr.Status, map[string]*apierror.Error{"error": apiErr})
}
