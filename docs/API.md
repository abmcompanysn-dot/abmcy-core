# Documentation d'intégration API — ABMCY Core

Cette documentation s'adresse aux tenants (ex: HANI'S) et à leurs développeurs
qui veulent connecter leur propre site ou application à la plateforme ABMCY
Core.

**URL de base de l'API :** `https://api.abmcy.com`

Un tenant peut aussi utiliser son propre sous-domaine (ex:
`https://hanis.api.abmcy.com`) pour les routes publiques d'authentification
client — ça dispense de préciser `tenant_slug` dans le corps de la requête.
Contactez ABMCY pour faire configurer ce sous-domaine.

## Sommaire

1. [Authentification](#authentification)
2. [Format des réponses et des erreurs](#format-des-réponses-et-des-erreurs)
3. [Commandes](#commandes)
4. [Mesures sur-mesure](#mesures-sur-mesure)
5. [Upload d'images](#upload-dimages)
6. [Paiements](#paiements)
7. [Notifications email](#notifications-email)
8. [Catalogue (optionnel)](#catalogue-optionnel)
9. [Comptes clients finaux](#comptes-clients-finaux)
10. [Gestion de l'équipe](#gestion-de-léquipe)
11. [Codes d'erreur](#codes-derreur)

---

## Authentification

Il existe **trois types d'accès distincts** à l'API, à ne pas confondre :

| Type | Utilisé par | Comment s'authentifier |
|---|---|---|
| **Clé API tenant** (`X-API-Key`) | Intégration technique (votre site, vos scripts) | Header `X-API-Key: pk_live_...` |
| **JWT personnel** | Un membre de votre équipe connecté au dashboard | `POST /auth/login` puis `Authorization: Bearer <token>` |
| **JWT client final** | Un client qui achète chez vous (ex: Fatou) | `POST /auth/customer/login` puis `Authorization: Bearer <token>` |

**Pour une intégration technique** (votre site web, une app mobile, un
script), utilisez la **clé API tenant** — c'est la méthode recommandée et la
plus simple. Vous la trouvez dans votre dashboard, ou elle vous a été
communiquée à la création de votre compte.

```bash
curl https://api.abmcy.com/orders \
  -H "X-API-Key: pk_live_votre_cle_ici"
```

Les routes qui acceptent `X-API-Key` acceptent **aussi** un JWT personnel —
les deux donnent accès aux mêmes données de votre compte. Seules quelques
routes de gestion d'équipe (créer un compte staff, se déconnecter) exigent
un JWT personnel, car une clé API n'a pas d'identité individuelle.

### Connexion personnel (JWT)

```http
POST /auth/login
Content-Type: application/json

{
  "tenant_slug": "hanis",
  "email": "contact@mahu.cards",
  "password": "votre-mot-de-passe"
}
```

Réponse `200` :
```json
{ "token": "eyJhbGciOi..." }
```

Utilisez ensuite ce token sur les mêmes routes que `X-API-Key` :
```
Authorization: Bearer eyJhbGciOi...
```

Le token expire après 24h — reconnectez-vous pour en obtenir un nouveau.

---

## Format des réponses et des erreurs

Toutes les erreurs suivent le même format JSON :

```json
{
  "error": {
    "code": "validation_error",
    "message": "Données invalides."
  }
}
```

Les réponses de succès sont soit un objet/tableau JSON (`200`, `201`), soit
vides (`204 No Content`). Un `202 Accepted` signifie que la demande a été
acceptée mais traitée de façon asynchrone (ex: envoi d'email).

---

## Commandes

### Créer une commande

```http
POST /orders
X-API-Key: pk_live_...
Content-Type: application/json

{
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "customer_email": "fatou@example.com",
  "total_amount": 25000,
  "measurements": { "poitrine": 92, "taille": 80 }
}
```

Réponse `201` :
```json
{
  "id": "c5a72dc0-...",
  "order_number": "ORD-123456789",
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "customer_email": "fatou@example.com",
  "total_amount": 25000,
  "status": "pending",
  "measurements": { "poitrine": 92, "taille": 80 },
  "created_at": "2026-09-07T12:00:00Z"
}
```

Si `customer_email` est fourni, un email de confirmation est envoyé
automatiquement (sans jamais faire échouer la commande si l'envoi rate).

### Créer une commande sur-mesure (avec tissu)

```http
POST /custom-orders
X-API-Key: pk_live_...
Content-Type: application/json

{
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "customer_email": "fatou@example.com",
  "shipping_address": "Dakar, Sénégal",
  "total_amount": 45000,
  "measurements": { "poitrine": 92, "taille": 80, "hanches": 98 },
  "fabric_id": "uuid-du-tissu-ou-null",
  "fabric_source": "maison",
  "notes": "Manches longues souhaitées"
}
```

`fabric_source` : `"maison"` (tissu du catalogue), `"envoi_photo"` (le client
envoie sa propre photo), ou `"conseil_atelier"` (le client laisse le choix).

Réponse `201` : même structure de commande, avec `customer_id` rempli
automatiquement (le client est retrouvé ou créé par téléphone).

### Lister / consulter les commandes

```http
GET /orders
GET /orders/{orderID}
GET /orders/{orderID}/history
```

`GET /orders/{orderID}/history` retourne l'historique des changements de
statut :
```json
[
  { "status": "pending", "created_at": "2026-09-07T12:00:00Z" },
  { "status": "paid", "comment": "Paiement confirmé par CinetPay", "created_at": "2026-09-07T12:05:00Z" }
]
```

### Modifier une commande

Seules les commandes au statut `pending` ou `confirmed` restent modifiables.

```http
PATCH /orders/{orderID}
Content-Type: application/json

{
  "shipping_address": "Nouvelle adresse",
  "notes": "Commentaire mis à jour"
}
```

Tous les champs sont optionnels — seuls ceux fournis sont modifiés.

---

## Mesures sur-mesure

```http
POST /measurements
Content-Type: application/json

{
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "gender": "femme",
  "values": { "poitrine": 92, "taille": 80, "hanches": 98, "epaules": 40, "manches": 58, "longueur": 110 }
}
```

`gender` doit être `"femme"` ou `"homme"`. Le jeu de mesures attendu dans
`values` est libre (JSON), à vous de définir vos propres champs — pour
l'homme, ajoutez par exemple `"pantalon"`.

Réponse `201` :
```json
{ "id": "uuid", "gender": "femme", "values": { "poitrine": 92, ... } }
```

---

## Upload d'images

```http
POST /uploads/image
X-API-Key: pk_live_...
Content-Type: multipart/form-data

image=@photo.jpg
```

Réponse `201` :
```json
{ "id": "uuid", "url": "https://votre-domaine-images/...", "size_bytes": 245678 }
```

- Taille maximale : 25 Mo par fichier.
- Chaque tenant a un quota de stockage total (5 Go par défaut, ajustable) —
  au-delà, l'upload échoue avec `storage_quota_exceeded` (`413`).
- Si le stockage n'est pas encore configuré côté ABMCY, l'erreur
  `storage_not_configured` (`503`) est renvoyée — contactez ABMCY.

---

## Paiements

```http
POST /payments/init
Content-Type: application/json

{
  "order_id": "uuid-de-la-commande",
  "amount": 25000,
  "customer_name": "Fatou Diop",
  "customer_phone": "+221771234567",
  "return_url": "https://votre-site.com/merci"
}
```

Réponse `200` :
```json
{ "payment_url": "https://checkout.cinetpay.com/..." }
```

Redirigez votre client vers `payment_url` pour finaliser le paiement (Wave,
Orange Money, MTN MoMo, ou carte bancaire selon ce que le client choisit sur
la page de paiement). Une fois le paiement confirmé, la commande passe
automatiquement au statut `paid` — vous n'avez rien d'autre à faire, ABMCY
reçoit et vérifie la confirmation de son côté.

Si les paiements ne sont pas encore configurés côté ABMCY, l'erreur
`payment_not_configured` (`503`) est renvoyée.

---

## Notifications email

```http
POST /notifications/email
Content-Type: application/json

{
  "to": "client@example.com",
  "subject": "Votre commande est prête",
  "html": "<p>Bonjour, votre commande est prête à être récupérée.</p>",
  "template": "order_ready"
}
```

Réponse : `202 Accepted` (envoi traité de façon asynchrone).

**Quota : 100 emails par jour et par tenant**, remis à zéro chaque jour à
minuit. Au-delà, l'erreur `email_quota_exceeded` (`429`) est renvoyée.

---

## Catalogue (optionnel)

Le catalogue regroupe cinq services **indépendants**, chacun activé à la
demande par ABMCY selon votre activité : produits, tissus, panier, galerie,
avis. Un atelier de couture sur-mesure a par exemple `products_enabled`,
`fabrics_enabled` et `gallery_enabled` sans `cart_enabled` (les commandes
passent par `/custom-orders`, pas un panier classique). Si un service n'est
pas activé, ses routes renvoient un `403` avec un code dédié :
`products_not_enabled`, `fabrics_not_enabled`, `cart_not_enabled`,
`gallery_not_enabled` ou `reviews_not_enabled`. Vérifiez votre statut :

```http
GET /features
```
```json
{
  "products_enabled": true,
  "fabrics_enabled": true,
  "cart_enabled": false,
  "gallery_enabled": true,
  "reviews_enabled": true
}
```

### Produits

Le modèle de produit est générique — `attributes` est un objet JSON libre où
vous mettez ce qui a du sens pour votre activité (tailles/couleurs pour la
couture, poids/marque pour un commerce général, lien de téléchargement pour
un produit numérique...).

```http
POST /products
Content-Type: application/json

{
  "name": "Robe wax",
  "description": "Robe en tissu wax, coupe ajustée",
  "price": 35000,
  "category": "robes",
  "sku": "ROB-001",
  "stock_quantity": 5,
  "attributes": { "tailles": ["S", "M", "L"], "couleurs": ["Bleu nuit", "Blanc cassé"] },
  "is_featured": true
}
```

```http
GET /products?category=robes&sort=price_asc
GET /products/{productID}
```

`sort` accepte : `price_asc`, `price_desc`, `newest`, `featured`.

### Tissus

```http
GET /fabrics
POST /fabrics
{ "name": "Wax hollandais", "description": "...", "extra_price": 5000, "image_url": "..." }

POST /fabrics/upload   (multipart, champ "image" — le client envoie sa propre photo de tissu)
```

### Galerie de réalisations

```http
GET /gallery?category=femme
POST /gallery
{ "image_url": "...", "category": "femme", "caption": "Robe de mariée sur-mesure" }
```

`category` : `femme`, `homme`, `sur_mesure`, ou `artisanat`.

### Panier

Le panier est sauvegardé côté serveur, identifié par un `cart_token` opaque
(généré automatiquement au premier ajout si vous n'en fournissez pas).

```http
POST /cart
{ "product_id": "uuid", "fabric_id": "uuid-ou-null", "size": "M", "color": "Bleu", "quantity": 1 }
```
```json
{ "cart_token": "a1b2c3...", "item": { "id": "uuid", "product_id": "uuid", "quantity": 1 } }
```

```http
GET /cart?cart_token=a1b2c3...
DELETE /cart/{itemID}?cart_token=a1b2c3...
```

### Avis clients

Les avis sont créés non publiés par défaut — ils doivent être modérés avant
d'apparaître publiquement.

```http
POST /reviews
{ "order_id": "uuid", "rating": 5, "comment": "Très satisfaite !", "photo_urls": ["url1", "url2"] }

GET /reviews            # avis publiés uniquement
GET /reviews/pending     # avis en attente de modération
POST /reviews/{reviewID}/publish
```

---

## Comptes clients finaux

Vos clients (les acheteurs, ex: Fatou) peuvent créer leur propre compte pour
suivre leurs commandes en ligne — indépendamment de votre clé API. Ces
routes sont **publiques**, identifiées par `tenant_slug` (ou le sous-domaine
si configuré).

```http
POST /auth/customer/register
{ "tenant_slug": "hanis", "phone": "+221771234567", "email": "fatou@example.com", "password": "motdepasse123" }
```

> Un client doit déjà exister (créé automatiquement lors de sa première
> commande) avant de pouvoir s'inscrire — sinon `customer_not_found` (`404`).

```http
POST /auth/customer/login
{ "tenant_slug": "hanis", "phone": "+221771234567", "password": "motdepasse123" }
```

```http
POST /auth/customer/forgot-password
{ "tenant_slug": "hanis", "email": "fatou@example.com" }
```

```http
POST /auth/customer/reset-password
{ "tenant_slug": "hanis", "token": "token-reçu-par-email", "new_password": "nouveau123" }
```

Une fois connecté (`Authorization: Bearer <token>`) :

```http
POST /auth/customer/logout
GET  /auth/customer/me
PATCH /auth/customer/me
{ "name": "...", "email": "...", "shipping_address": "..." }
```

---

## Gestion de l'équipe

Réservé aux comptes connectés par **JWT personnel** (`POST /auth/login`) —
une clé API seule ne suffit pas pour ces actions (`staff_login_required`,
`403`).

```http
GET /staff                                    # lister l'équipe
POST /staff                                   # ajouter un membre (réservé au rôle "owner")
{ "email": "couturiere@mahu.cards", "password": "...", "role": "staff" }

PUT /staff/{userID}/active                    # activer/désactiver un compte (owner uniquement)
{ "is_active": false }

POST /auth/logout                             # déconnexion (révoque le token)
```

---

## Codes d'erreur

| Code | HTTP | Signification |
|---|---|---|
| `missing_api_key` | 401 | Aucune clé API fournie |
| `invalid_api_key` | 403 | Clé API invalide ou compte désactivé |
| `unauthorized` | 401 | Identifiants invalides |
| `forbidden` | 403 | Accès refusé (droits insuffisants) |
| `staff_login_required` | 403 | Cette action nécessite un JWT personnel, pas une clé API |
| `not_found` | 404 | Ressource introuvable |
| `customer_not_found` | 404 | Aucun profil client pour ce téléphone |
| `unknown_config_key` | 404 | Clé de configuration inconnue |
| `validation_error` | 422 | Données invalides ou incomplètes |
| `products_not_enabled` | 403 | Le service produits n'est pas activé pour ce compte |
| `fabrics_not_enabled` | 403 | Le service tissus n'est pas activé pour ce compte |
| `cart_not_enabled` | 403 | Le service panier n'est pas activé pour ce compte |
| `gallery_not_enabled` | 403 | Le service galerie n'est pas activé pour ce compte |
| `reviews_not_enabled` | 403 | Le service avis n'est pas activé pour ce compte |
| `order_not_editable` | 409 | La commande n'est plus modifiable |
| `invalid_or_expired_token` | 400 | Lien de réinitialisation invalide ou expiré |
| `file_too_large` | 413 | Fichier de plus de 25 Mo |
| `storage_quota_exceeded` | 413 | Quota de stockage dépassé |
| `storage_not_configured` | 503 | Stockage d'images pas encore configuré côté ABMCY |
| `payment_not_configured` | 503 | Paiements pas encore configurés côté ABMCY |
| `email_quota_exceeded` | 429 | Quota de 100 emails/jour dépassé |
| `rate_limited` | 429 | Trop de requêtes — ralentissez |
| `internal_error` | 500 | Erreur interne — contactez ABMCY si persistant |

---

*Des questions ? Contactez l'équipe ABMCY.*
