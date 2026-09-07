package apierror

// Error is the uniform error shape returned to API clients:
// {"error": {"code": "...", "message": "..."}}
type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

func (e *Error) Error() string { return e.Message }

func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

var (
	ErrMissingAPIKey   = New(401, "missing_api_key", "Clé d'API manquante.")
	ErrInvalidAPIKey   = New(403, "invalid_api_key", "Clé d'API invalide ou compte suspendu.")
	ErrStorageQuota    = New(413, "storage_quota_exceeded", "Quota de stockage dépassé. Veuillez mettre à niveau votre forfait.")
	ErrEmailQuota      = New(429, "email_quota_exceeded", "Quota d'envoi d'emails journalier dépassé (100/jour).")
	ErrUnauthorized    = New(401, "unauthorized", "Authentification requise.")
	ErrForbidden       = New(403, "forbidden", "Accès refusé.")
	ErrNotFound        = New(404, "not_found", "Ressource introuvable.")
	ErrValidation      = New(422, "validation_error", "Données invalides.")
	ErrInternal        = New(500, "internal_error", "Erreur interne du serveur.")
	ErrRateLimited     = New(429, "rate_limited", "Trop de requêtes, réessayez plus tard.")
)
