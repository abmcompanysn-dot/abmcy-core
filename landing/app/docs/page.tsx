import type { Metadata } from "next";
import "./docs.css";
import { ScrollSpy } from "./ScrollSpy";

export const metadata: Metadata = {
  title: "Documentation API — ABMCY Core",
  description:
    "Guide de référence pour connecter votre site, votre application ou vos scripts à la plateforme ABMCY — commandes, mesures sur-mesure, paiements, catalogue et comptes clients.",
};

const TOC_LINKS = [
  { href: "#auth", label: "Authentification" },
  { href: "#errors-format", label: "Format des erreurs" },
  { href: "#orders", label: "Commandes" },
  { href: "#measurements", label: "Mesures sur-mesure" },
  { href: "#uploads", label: "Upload d'images" },
  { href: "#payments", label: "Paiements" },
  { href: "#emails", label: "Notifications email" },
  { href: "#catalog", label: "Catalogue (optionnel)" },
  { href: "#customers", label: "Comptes clients finaux" },
  { href: "#staff", label: "Gestion de l'équipe" },
  { href: "#errors", label: "Codes d'erreur" },
];

const ERROR_CODES: { code: string; status: string; meaning: string }[] = [
  { code: "missing_api_key", status: "401", meaning: "Aucune clé API fournie" },
  { code: "invalid_api_key", status: "403", meaning: "Clé invalide ou compte désactivé" },
  { code: "unauthorized", status: "401", meaning: "Identifiants invalides" },
  { code: "forbidden", status: "403", meaning: "Droits insuffisants" },
  { code: "staff_login_required", status: "403", meaning: "JWT personnel requis, pas une clé API" },
  { code: "not_found", status: "404", meaning: "Ressource introuvable" },
  { code: "customer_not_found", status: "404", meaning: "Aucun profil pour ce téléphone" },
  { code: "unknown_config_key", status: "404", meaning: "Clé de configuration inconnue" },
  { code: "validation_error", status: "422", meaning: "Données invalides ou incomplètes" },
  { code: "products_not_enabled", status: "403", meaning: "Service produits non activé pour ce compte" },
  { code: "fabrics_not_enabled", status: "403", meaning: "Service tissus non activé pour ce compte" },
  { code: "cart_not_enabled", status: "403", meaning: "Service panier non activé pour ce compte" },
  { code: "gallery_not_enabled", status: "403", meaning: "Service galerie non activé pour ce compte" },
  { code: "reviews_not_enabled", status: "403", meaning: "Service avis non activé pour ce compte" },
  { code: "order_not_editable", status: "409", meaning: "Commande plus modifiable" },
  { code: "invalid_or_expired_token", status: "400", meaning: "Lien de réinitialisation invalide/expiré" },
  { code: "file_too_large", status: "413", meaning: "Fichier > 25 Mo" },
  { code: "storage_quota_exceeded", status: "413", meaning: "Quota de stockage dépassé" },
  { code: "storage_not_configured", status: "503", meaning: "Stockage pas encore configuré côté ABMCY" },
  { code: "payment_not_configured", status: "503", meaning: "Paiements pas encore configurés côté ABMCY" },
  { code: "email_quota_exceeded", status: "429", meaning: "Quota de 100 emails/jour dépassé" },
  { code: "rate_limited", status: "429", meaning: "Trop de requêtes — ralentissez" },
  { code: "internal_error", status: "500", meaning: "Erreur interne — contactez ABMCY" },
];

export default function DocsPage() {
  return (
    <div className="docs-page">
      <ScrollSpy />
      <div className="docs-layout">
        <nav className="docs-toc" id="toc">
          <div className="docs-brand">
            <span className="docs-brand-mark">A</span>
            <span className="docs-brand-name">ABMCY Core</span>
          </div>
          <p className="docs-brand-sub">Intégration API</p>

          <div className="docs-toc-group">
            {TOC_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="docs-base-url-box">
            <div className="docs-label">URL de base</div>
            <code>https://api.abmcy.com</code>
          </div>
        </nav>

        <main className="docs-main">
          <header className="docs-page-head">
            <h1 className="docs-title">Intégrer votre site à ABMCY Core</h1>
            <p className="docs-lede">
              Guide de référence pour connecter votre site, votre application ou vos
              scripts à la plateforme ABMCY — commandes, mesures sur-mesure, paiements,
              catalogue et comptes clients.
            </p>
          </header>

          <section className="docs-topic" id="auth">
            <h2>Authentification</h2>
            <p className="docs-desc">Trois accès distincts, à ne pas confondre.</p>

            <table className="docs-auth-table">
              <tbody>
                <tr>
                  <th>Type</th>
                  <th>Utilisé par</th>
                  <th>Comment</th>
                </tr>
                <tr>
                  <td>Clé API tenant</td>
                  <td>Votre site, vos scripts</td>
                  <td>
                    <code>X-API-Key: pk_live_...</code>
                  </td>
                </tr>
                <tr>
                  <td>JWT personnel</td>
                  <td>Un membre de votre équipe</td>
                  <td>
                    <code>POST /auth/login</code> puis <code>Bearer</code>
                  </td>
                </tr>
                <tr>
                  <td>JWT client final</td>
                  <td>Un acheteur (ex: Fatou)</td>
                  <td>
                    <code>POST /auth/customer/login</code> puis <code>Bearer</code>
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="docs-op-note">
              Pour une intégration technique, utilisez la <strong>clé API tenant</strong>{" "}
              — c&apos;est la méthode recommandée. Elle vous a été communiquée à la
              création de votre compte, ou se trouve dans votre dashboard.
            </p>

            <h3 className="docs-op-title">Exemple : appeler l&apos;API avec votre clé</h3>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">bash</span>
              </div>
              <pre className="docs-code-body">
                <span className="c"># Toutes les routes tenant acceptent ce header</span>
                {"\n"}curl https://api.abmcy.com/orders \{"\n"}
                {"  "}-H <span className="s">&quot;X-API-Key: pk_live_votre_cle_ici&quot;</span>
              </pre>
            </div>

            <h3 className="docs-op-title">Connexion personnel (JWT)</h3>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/auth/login</span>
                <span className="docs-endpoint-auth">public</span>
              </div>
              <pre className="docs-code-body">{`{
  "tenant_slug": "hanis",
  "email": "contact@mahu.cards",
  "password": "votre-mot-de-passe"
}`}</pre>
            </div>
            <span className="docs-response-tag ok">200 OK</span>
            <div className="docs-endpoint">
              <pre className="docs-code-body">{`{ "token": "eyJhbGciOi..." }`}</pre>
            </div>
            <p className="docs-op-note">
              Utilisez ensuite <code>Authorization: Bearer &lt;token&gt;</code> sur les
              mêmes routes que <code>X-API-Key</code>. Le token expire après 24h.
            </p>
          </section>

          <section className="docs-topic" id="errors-format">
            <h2>Format des réponses</h2>
            <p className="docs-desc">Toutes les erreurs suivent la même structure JSON.</p>
            <div className="docs-endpoint">
              <pre className="docs-code-body">{`{
  "error": {
    "code": "validation_error",
    "message": "Données invalides."
  }
}`}</pre>
            </div>
            <p className="docs-op-note">
              Un succès est un objet/tableau JSON (<code>200</code>, <code>201</code>) ou
              une réponse vide (<code>204</code>). Un <code>202</code> signifie une
              demande acceptée mais traitée de façon asynchrone.
            </p>
          </section>

          <section className="docs-topic" id="orders">
            <h2>Commandes</h2>
            <p className="docs-desc">
              Créer, consulter et faire évoluer les commandes de vos clients.
            </p>

            <h3 className="docs-op-title">Créer une commande</h3>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/orders</span>
                <span className="docs-endpoint-auth">X-API-Key</span>
              </div>
              <pre className="docs-code-body">{`{
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "customer_email": "fatou@example.com",
  "total_amount": 25000,
  "measurements": { "poitrine": 92, "taille": 80 }
}`}</pre>
            </div>
            <span className="docs-response-tag ok">201 Created</span>
            <div className="docs-endpoint">
              <pre className="docs-code-body">{`{
  "id": "c5a72dc0-...",
  "order_number": "ORD-123456789",
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "total_amount": 25000,
  "status": "pending",
  "created_at": "2026-09-07T12:00:00Z"
}`}</pre>
            </div>
            <p className="docs-op-note">
              Si <code>customer_email</code> est fourni, un email de confirmation part
              automatiquement — un échec d&apos;envoi ne fait jamais échouer la commande.
            </p>

            <h3 className="docs-op-title">Commande sur-mesure (avec tissu)</h3>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/custom-orders</span>
                <span className="docs-endpoint-auth">X-API-Key</span>
              </div>
              <pre className="docs-code-body">{`{
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "shipping_address": "Dakar, Sénégal",
  "total_amount": 45000,
  "measurements": { "poitrine": 92, "hanches": 98 },
  "fabric_id": "uuid-du-tissu",
  "fabric_source": "maison",
  "notes": "Manches longues souhaitées"
}`}</pre>
            </div>
            <p className="docs-op-note">
              <code>fabric_source</code> : <code>maison</code> (tissu du catalogue),{" "}
              <code>envoi_photo</code> (photo envoyée par le client), ou{" "}
              <code>conseil_atelier</code>.
            </p>

            <h3 className="docs-op-title">Lister, consulter, modifier</h3>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/orders</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/orders/{"{orderID}"}</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/orders/{"{orderID}"}/history</span>
              </div>
              <pre className="docs-code-body">{`[
  { "status": "pending", "created_at": "2026-09-07T12:00:00Z" },
  { "status": "paid", "comment": "Paiement confirmé par CinetPay", "created_at": "2026-09-07T12:05:00Z" }
]`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method patch">PATCH</span>
                <span className="docs-endpoint-path">/orders/{"{orderID}"}</span>
              </div>
              <pre className="docs-code-body">{`{ "shipping_address": "Nouvelle adresse", "notes": "..." }`}</pre>
            </div>
            <p className="docs-op-note">
              Seules les commandes <code>pending</code> ou <code>confirmed</code> restent
              modifiables — sinon <span className="docs-err-code">order_not_editable</span>.
            </p>
          </section>

          <section className="docs-topic" id="measurements">
            <h2>Mesures sur-mesure</h2>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/measurements</span>
              </div>
              <pre className="docs-code-body">{`{
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "gender": "femme",
  "values": {
    "poitrine": 92, "taille": 80, "hanches": 98,
    "epaules": 40, "manches": 58, "longueur": 110
  }
}`}</pre>
            </div>
            <p className="docs-op-note">
              <code>gender</code> : <code>femme</code> ou <code>homme</code>. Le contenu
              de <code>values</code> est libre — définissez vos propres champs (ex:
              ajoutez <code>pantalon</code> pour un homme).
            </p>
          </section>

          <section className="docs-topic" id="uploads">
            <h2>Upload d&apos;images</h2>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/uploads/image</span>
              </div>
              <pre className="docs-code-body">{`Content-Type: multipart/form-data

image=@photo.jpg`}</pre>
            </div>
            <span className="docs-response-tag ok">201 Created</span>
            <div className="docs-endpoint">
              <pre className="docs-code-body">{`{ "id": "uuid", "url": "https://...", "size_bytes": 245678 }`}</pre>
            </div>
            <div className="docs-callout">
              <strong>25 Mo</strong> maximum par fichier. Chaque tenant a un{" "}
              <strong>quota de stockage</strong> (5 Go par défaut) — au-delà,{" "}
              <span className="docs-err-code">storage_quota_exceeded</span>.
            </div>
            <p className="docs-op-note">
              Cette route téléverse un fichier brut (<code>multipart/form-data</code>)
              vers le stockage ABMCY (Cloudflare R2) et renvoie son URL publique
              définitive. Elle ne rattache l&apos;image à aucun produit — voir{" "}
              <a href="#catalog-images">Rattacher une image à un produit</a> ci-dessous
              pour l&apos;associer à un article de votre catalogue, ou{" "}
              <code>POST /gallery</code> pour l&apos;afficher dans votre galerie de
              réalisations.
            </p>
          </section>

          <section className="docs-topic" id="payments">
            <h2>Paiements</h2>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/payments/init</span>
              </div>
              <pre className="docs-code-body">{`{
  "order_id": "uuid-de-la-commande",
  "amount": 25000,
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "return_url": "https://votre-site.com/merci"
}`}</pre>
            </div>
            <span className="docs-response-tag ok">200 OK</span>
            <div className="docs-endpoint">
              <pre className="docs-code-body">{`{ "payment_url": "https://checkout.cinetpay.com/..." }`}</pre>
            </div>
            <p className="docs-op-note">
              Redirigez votre client vers <code>payment_url</code> — Wave, Orange Money,
              MTN MoMo ou carte selon son choix. Une fois confirmé, la commande passe
              automatiquement à <code>paid</code>, sans action de votre part.
            </p>
          </section>

          <section className="docs-topic" id="emails">
            <h2>Notifications email</h2>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/notifications/email</span>
              </div>
              <pre className="docs-code-body">{`{
  "to": "client@example.com",
  "subject": "Votre commande est prête",
  "html": "<p>Bonjour...</p>",
  "template": "order_ready"
}`}</pre>
            </div>
            <span className="docs-response-tag ok">202 Accepted</span>
            <div className="docs-callout">
              <strong>100 emails / jour</strong> par tenant, remis à zéro chaque minuit.
              Au-delà : <span className="docs-err-code">email_quota_exceeded</span>.
            </div>
            <p className="docs-op-note">
              Le contenu HTML que vous envoyez ici est utilisé tel quel. Les emails
              générés automatiquement par ABMCY (confirmation de commande, bienvenue,
              réinitialisation de mot de passe) utilisent un gabarit visuel commun —
              même mise en page, mêmes couleurs — pour rester cohérents avec vos autres
              communications.
            </p>
          </section>

          <section className="docs-topic" id="catalog">
            <h2>
              Catalogue{" "}
              <span style={{ fontWeight: 400, color: "var(--docs-text-faint)", fontSize: 16 }}>
                — optionnel
              </span>
            </h2>
            <p className="docs-desc">
              Produits, tissus, panier, galerie et avis — activé à la demande pour votre
              compte. Vérifiez votre statut :
            </p>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/features</span>
              </div>
              <pre className="docs-code-body">{`{
  "products_enabled": true,
  "fabrics_enabled": true,
  "cart_enabled": false,
  "gallery_enabled": true,
  "reviews_enabled": true
}`}</pre>
            </div>
            <p className="docs-op-note">
              Cinq services indépendants, chacun activable séparément selon
              votre activité — un atelier de couture sur-mesure peut par
              exemple avoir <code>products_enabled</code>,{" "}
              <code>fabrics_enabled</code> et <code>gallery_enabled</code> sans{" "}
              <code>cart_enabled</code> (les commandes passent par{" "}
              <code>/custom-orders</code> plutôt qu&apos;un panier classique).
              Si un service est désactivé, ses routes renvoient un 403 avec un
              code dédié : <span className="docs-err-code">products_not_enabled</span>,{" "}
              <span className="docs-err-code">fabrics_not_enabled</span>,{" "}
              <span className="docs-err-code">cart_not_enabled</span>,{" "}
              <span className="docs-err-code">gallery_not_enabled</span> ou{" "}
              <span className="docs-err-code">reviews_not_enabled</span>.
            </p>

            <h3 className="docs-op-title">Produits — modèle générique</h3>
            <p className="docs-op-note">
              <code>attributes</code> est un objet libre : tailles/couleurs pour la
              couture, poids/marque pour un commerce général, lien de téléchargement
              pour un produit numérique — à vous de choisir.
            </p>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/products</span>
              </div>
              <pre className="docs-code-body">{`{
  "name": "Robe wax",
  "price": 35000,
  "category": "robes",
  "sku": "ROB-001",
  "stock_quantity": 5,
  "attributes": { "tailles": ["S","M","L"], "couleurs": ["Bleu nuit"] },
  "is_featured": true
}`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/products?category=robes&amp;sort=price_asc</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/products/{"{productID}"}</span>
              </div>
              <pre className="docs-code-body">{`{
  "id": "uuid",
  "name": "Robe wax",
  "price": 35000,
  "attributes": { "tailles": ["S","M","L"] },
  "images": [
    { "id": "uuid", "url": "https://abmcy.mahu.cards/..." }
  ]
}`}</pre>
            </div>
            <p className="docs-op-note">
              <code>sort</code> : <code>price_asc</code>, <code>price_desc</code>,{" "}
              <code>newest</code>, <code>featured</code>. Le tableau <code>images</code>{" "}
              peut contenir plusieurs photos par produit — la première sert de vignette
              dans les dashboards ABMCY.
            </p>

            <h3 className="docs-op-title" id="catalog-images">
              Rattacher une image à un produit
            </h3>
            <p className="docs-op-note">
              Il n&apos;y a pas de champ image direct sur <code>POST /products</code> —
              l&apos;image se rattache en deux temps, comme pour tout fichier sur ABMCY :
            </p>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/uploads/image</span>
              </div>
              <pre className="docs-code-body">{`1. Téléversez le fichier — multipart/form-data, champ "image"
   Réponse : { "id": "...", "url": "https://abmcy.mahu.cards/..." }`}</pre>
            </div>
            <p className="docs-op-note">
              2. Conservez l&apos;<code>url</code> obtenue et placez-la dans les{" "}
              <code>attributes</code> du produit (par convention, la clé{" "}
              <code>image_url</code>) lors de sa création ou de sa mise à jour —
              c&apos;est ce que les dashboards ABMCY lisent pour afficher la vignette du
              produit dans le catalogue.
            </p>
            <div className="docs-endpoint">
              <pre className="docs-code-body">{`{
  "name": "Robe wax",
  "price": 35000,
  "attributes": {
    "tailles": ["S","M","L"],
    "image_url": "https://abmcy.mahu.cards/.../robe-wax.jpg"
  }
}`}</pre>
            </div>
            <p className="docs-op-note">
              Exemple réel — 29 produits importés pour HANI&apos;S avec cette méthode,
              chaque photo étant à la fois l&apos;image du produit et ajoutée à la
              galerie (<code>POST /gallery</code>) pour apparaître aussi dans les
              réalisations de la boutique.
            </p>

            <h3 className="docs-op-title">Tissus &amp; galerie</h3>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/fabrics</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/fabrics</span>
              </div>
              <pre className="docs-code-body">{`{ "name": "Wax hollandais", "extra_price": 5000, "image_url": "..." }`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/fabrics/upload</span>
              </div>
              <pre className="docs-code-body">{`multipart/form-data, champ "image" — photo envoyée par le client`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/gallery</span>
              </div>
              <pre className="docs-code-body">{`{
  "image_url": "https://abmcy.mahu.cards/.../photo.jpg",
  "category": "femme",
  "caption": "Robe wax sur mesure"
}`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/gallery?category=femme</span>
              </div>
              <pre className="docs-code-body">{`[
  {
    "id": "uuid",
    "image_url": "https://abmcy.mahu.cards/...",
    "category": "femme",
    "caption": "Robe wax sur mesure"
  }
]`}</pre>
            </div>
            <p className="docs-op-note">
              <code>category</code> : <code>femme</code>, <code>homme</code>,{" "}
              <code>sur_mesure</code>, <code>artisanat</code>. Contrairement au produit
              (où l&apos;image vit dans <code>attributes</code>), la galerie a un vrai
              champ <code>image_url</code> dédié — c&apos;est la vue pensée pour être
              affichée en grille de photos, dans votre dashboard comme sur un site
              public.
            </p>

            <h3 className="docs-op-title">Panier</h3>
            <p className="docs-op-note">
              Sauvegardé côté serveur, identifié par un <code>cart_token</code> opaque
              (généré automatiquement si absent).
            </p>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/cart</span>
              </div>
              <pre className="docs-code-body">{`{ "product_id": "uuid", "size": "M", "color": "Bleu", "quantity": 1 }`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/cart?cart_token=...</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method delete">DELETE</span>
                <span className="docs-endpoint-path">/cart/{"{itemID}"}?cart_token=...</span>
              </div>
            </div>

            <h3 className="docs-op-title">Avis clients</h3>
            <p className="docs-op-note">
              Créés non publiés par défaut — modération requise avant affichage public.
            </p>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/reviews</span>
              </div>
              <pre className="docs-code-body">{`{ "order_id": "uuid", "rating": 5, "comment": "Très satisfaite !" }`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/reviews/pending</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/reviews/{"{reviewID}"}/publish</span>
              </div>
            </div>
          </section>

          <section className="docs-topic" id="customers">
            <h2>Comptes clients finaux</h2>
            <p className="docs-desc">
              Vos acheteurs peuvent suivre leurs commandes en ligne, indépendamment de
              votre clé API.
            </p>

            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/auth/customer/register</span>
                <span className="docs-endpoint-auth">public</span>
              </div>
              <pre className="docs-code-body">{`{ "tenant_slug": "hanis", "phone": "+221771234567", "password": "motdepasse123" }`}</pre>
            </div>
            <p className="docs-op-note">
              Le client doit déjà exister (créé lors de sa première commande) — sinon{" "}
              <span className="docs-err-code">customer_not_found</span>.
            </p>

            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/auth/customer/login</span>
                <span className="docs-endpoint-auth">public</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/auth/customer/forgot-password</span>
                <span className="docs-endpoint-auth">public</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/auth/customer/reset-password</span>
                <span className="docs-endpoint-auth">public</span>
              </div>
            </div>

            <h3 className="docs-op-title">Une fois connecté (Bearer token)</h3>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/auth/customer/logout</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/auth/customer/me</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method patch">PATCH</span>
                <span className="docs-endpoint-path">/auth/customer/me</span>
              </div>
              <pre className="docs-code-body">{`{ "name": "...", "shipping_address": "..." }`}</pre>
            </div>
          </section>

          <section className="docs-topic" id="staff">
            <h2>Gestion de l&apos;équipe</h2>
            <p className="docs-desc">
              Réservé aux comptes connectés par JWT personnel — une clé API seule ne
              suffit pas.
            </p>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method get">GET</span>
                <span className="docs-endpoint-path">/staff</span>
              </div>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/staff</span>
                <span className="docs-endpoint-auth">owner</span>
              </div>
              <pre className="docs-code-body">{`{ "email": "couturiere@mahu.cards", "password": "...", "role": "staff" }`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method put">PUT</span>
                <span className="docs-endpoint-path">/staff/{"{userID}"}/active</span>
                <span className="docs-endpoint-auth">owner</span>
              </div>
              <pre className="docs-code-body">{`{ "is_active": false }`}</pre>
            </div>
            <div className="docs-endpoint">
              <div className="docs-endpoint-head">
                <span className="docs-method post">POST</span>
                <span className="docs-endpoint-path">/auth/logout</span>
              </div>
            </div>
          </section>

          <section className="docs-topic" id="errors">
            <h2>Codes d&apos;erreur</h2>
            <p className="docs-desc">
              Tous suivent le format <code>{`{"error":{"code","message"}}`}</code> décrit
              plus haut.
            </p>
            <table className="docs-err-table">
              <tbody>
                <tr>
                  <th>Code</th>
                  <th>HTTP</th>
                  <th>Signification</th>
                </tr>
                {ERROR_CODES.map((e) => (
                  <tr key={e.code}>
                    <td>
                      <span className="docs-err-code">{e.code}</span>
                    </td>
                    <td className="docs-http-status">{e.status}</td>
                    <td>{e.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>

      <div className="docs-foot">
        Des questions ? Contactez l&apos;équipe ABMCY. — Documentation ABMCY Core
        Multi-Tenant.
      </div>
    </div>
  );
}
