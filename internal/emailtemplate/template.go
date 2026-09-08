// Package emailtemplate renders the HTML shell used by every
// transactional email ABMCY sends (order confirmation, tenant welcome,
// password reset). Centralizing it here means a design change happens
// once instead of being copy-pasted across every handler that sends
// mail — the previous approach (internal/httpserver concatenating raw
// HTML strings by hand) is exactly what this replaces.
//
// The markup follows email-client conventions rather than modern web
// practice: everything is table-based layout with inline styles, no
// external stylesheet, no CSS variables, no flexbox/grid — Outlook,
// Gmail's HTML sanitizer, and older mobile mail clients all strip or
// mangle anything fancier than that.
package emailtemplate

import (
	"fmt"
	"html"
	"strings"
)

const (
	colorInk      = "#1a1d23" // corps de texte
	colorMuted    = "#6b7280" // texte secondaire (pied de page)
	colorAccent   = "#4338ca" // indigo — cohérent avec les dashboards
	colorBorder   = "#e5e7eb"
	colorBgOuter  = "#f4f4f2"
	colorBgCard   = "#ffffff"
	colorBtnText  = "#ffffff"
	senderProduct = "ABMCY Core"
)

// Button is an optional call-to-action rendered as a table-based button
// (a bare <a> styled with padding renders inconsistently across clients;
// a table cell with a background color is the standard workaround).
type Button struct {
	Label string
	URL   string
}

// Data is everything a rendered email needs. Paragraphs are rendered as
// separate <p> blocks in order; each is HTML-escaped, so callers pass
// plain text, never pre-built HTML — this is what keeps user-controlled
// strings (a customer's name, a tenant's name) from ever being
// interpreted as markup.
type Data struct {
	// SenderName appears as a small eyebrow above the heading — e.g. a
	// tenant's name ("HANI'S") for emails sent on their behalf, or left
	// empty for platform-level emails (signed just "ABMCY Core").
	SenderName string
	Heading    string
	Paragraphs []string
	Button     *Button // nil = no button rendered
	// FooterNote is small print at the bottom (e.g. "Vous recevez cet
	// email suite à votre commande chez HANI'S."). Optional.
	FooterNote string
}

// Render produces a complete standalone HTML document ready to hand to
// Resend as the email body.
func Render(d Data) string {
	var b strings.Builder

	eyebrow := senderProduct
	if d.SenderName != "" {
		eyebrow = html.EscapeString(d.SenderName)
	}

	b.WriteString(fmt.Sprintf(`<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background-color:%s; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:%s;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:%s; border-radius:12px; border:1px solid %s; overflow:hidden;">

<tr><td style="padding:28px 32px 0 32px;">
  <div style="font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:%s;">%s</div>
</td></tr>

<tr><td style="padding:8px 32px 24px 32px;">
  <h1 style="margin:0; font-size:22px; line-height:1.35; font-weight:700; color:%s;">%s</h1>
</td></tr>
`, colorBgOuter, colorBgOuter, colorBgCard, colorBorder, colorAccent, eyebrow, colorInk, html.EscapeString(d.Heading)))

	for _, p := range d.Paragraphs {
		fmt.Fprintf(&b, `<tr><td style="padding:0 32px 16px 32px;">
  <p style="margin:0; font-size:15px; line-height:1.6; color:%s;">%s</p>
</td></tr>
`, colorInk, html.EscapeString(p))
	}

	if d.Button != nil {
		fmt.Fprintf(&b, `<tr><td style="padding:8px 32px 28px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="border-radius:8px; background-color:%s;">
      <a href="%s" style="display:inline-block; padding:12px 24px; font-size:15px; font-weight:600; color:%s; text-decoration:none;">%s</a>
    </td>
  </tr></table>
</td></tr>
`, colorAccent, html.EscapeString(d.Button.URL), colorBtnText, html.EscapeString(d.Button.Label))
	}

	footer := d.FooterNote
	if footer == "" {
		footer = "ABMCY Core — plateforme multi-tenant pour commerçants et artisans."
	}
	fmt.Fprintf(&b, `<tr><td style="padding:20px 32px 28px 32px; border-top:1px solid %s;">
  <p style="margin:0; font-size:12.5px; line-height:1.5; color:%s;">%s</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`, colorBorder, colorMuted, html.EscapeString(footer))

	return b.String()
}
