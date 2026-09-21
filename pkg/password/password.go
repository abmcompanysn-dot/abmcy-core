// Package password centralizes the minimum password policy shared by every
// account type (staff, admin, customer, tenant owner) so the rule can't
// drift between the several places a password is set.
package password

import "unicode"

// Valid reports whether password meets the minimum bar: at least 8
// characters, containing at least one letter and one digit. This isn't a
// full complexity policy (no symbol requirement, no common-password check)
// but it rules out the weakest cases (all-digits, all-letters, too short)
// that a length-only check let through.
func Valid(pw string) bool {
	if len(pw) < 8 {
		return false
	}
	var hasLetter, hasDigit bool
	for _, r := range pw {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	return hasLetter && hasDigit
}

// Message is the validation error text to show when Valid returns false.
const Message = "Le mot de passe doit contenir au moins 8 caractères, avec au moins une lettre et un chiffre."
