# ABMCY Core Multi-Tenant — Contexte projet

Ce fichier permet à Claude Code de reprendre le travail sans réexplication, même
sur une nouvelle machine ou une nouvelle session. Le README.md donne la vue
d'ensemble ; ce fichier donne le contexte, les décisions et l'état d'avancement.

## Qui, quoi, pourquoi

Le propriétaire du projet (contact : batekossi@gmail.com) développe une
plateforme SaaS/BaaS multi-tenant nommée **ABMCY Core Multi-Tenant**. Premier
client cible : **HANI'S** (boutique de couture/sur-mesure). Le principe :
plusieurs clients (tenants) partagent la même infrastructure backend, chacun
avec ses propres données isolées, son quota de stockage (5 Go par défaut,
ajustable par plan), et son quota d'emails (100/jour).

Domaines confirmés (2026-09-07) :
- `api.abmcy.com` — backend Go (VPS, remplace l'ancien `cors.abmcy.com`)
- `ad.abmcy.com` — dashboard super-admin (`admin-dashboard/`, Vercel)
- `dash.abmcy.com` — dashboard tenant/client (`tenant-dashboard/`, Vercel)
- `core.abmcy.com` — site vitrine du projet (`landing/`, Vercel — pas encore créé,
  doit inclure une animation de blocs qui se construisent pour visualiser
  l'architecture, demandée explicitement par l'utilisateur)

## Décisions d'architecture (déjà tranchées — ne pas reproposer sans raison)

- **Langage backend : Go**, pas TypeScript/Node (le tout premier brouillon du
  projet était en TS/Express, abandonné au profit de Go).
- **Modulith, pas microservices séparés** : un seul binaire Go
  (`cmd/api/main.go`) avec des packages internes (`internal/tenant`,
  `internal/order`, etc.), pas un service HTTP par domaine métier. Choisi car
  plus simple à opérer sur un VPS modeste (4 CPU / 6 Go RAM) — voir
  conversation d'origine si la raison est requestionnée.
- **Isolation multi-tenant : Postgres Row Level Security (RLS)**, pas juste un
  filtre applicatif `WHERE tenant_id = ...`. Toute requête tenant-scopée DOIT
  passer par `db.Pool.WithTenant(ctx, tenantID, fn)` (voir `internal/db/db.go`)
  qui positionne `app.tenant_id` en session Postgres avant d'exécuter quoi que
  ce soit. Les opérations cross-tenant (super-admin, création de tenant)
  passent par `db.Pool.WithSystem(ctx, fn)`. Ne jamais requêter les tables
  tenant-scopées (`orders`, `products`, `payments`, `product_images`,
  `email_logs`, `users`) hors de ces deux méthodes.
- **Images : Cloudflare R2** (bucket S3-compatible, sans frais de sortie),
  pas S3/MinIO/imgbb. Migré depuis imgbb le 2026-09-07 — imgbb n'offrait pas
  de garantie de service pour un usage SaaS commercial à volume. On stocke
  juste l'URL publique (via le domaine `img.abmcy.com` connecté au bucket) +
  le poids en base (pour calculer le quota). Voir `internal/storage/r2.go`
  (`R2Client`, utilise `aws-sdk-go-v2/service/s3` pointé sur l'endpoint R2).
  Variables d'env : `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
- **Emails : Resend**, quota strict de 100/jour par tenant appliqué côté
  serveur avant chaque envoi (voir `internal/notification/service.go`), pas
  seulement documenté/espéré.
- **Paiements : CinetPay** (agrège Wave, Orange Money, MTN MoMo, cartes) —
  choisi plutôt que d'intégrer chaque mobile money séparément. Stripe évoqué
  dans le brouillon initial mais pas implémenté (pas de demande explicite
  encore).
- **Orchestration : k3s** (Kubernetes léger), pas Kubernetes complet — décidé
  après clarification explicite avec l'utilisateur car un seul VPS ne justifie
  pas un control plane K8s complet. `docker-compose.yml` est conservé comme
  alternative plus simple, à ne pas supprimer sans que l'utilisateur le
  demande.
- **Deux dashboards distincts**, pas un seul dashboard avec des rôles :
  - `admin-dashboard/` — usage interne ABMCY uniquement, auth par clé
    `X-Admin-Key` statique (env var `ADMIN_API_KEY`).
  - `tenant-dashboard/` — usage par chaque client, auth par la clé API
    publique du tenant (`X-API-Key`, format `pk_live_...`).
  Les deux sont en Next.js 16 (App Router, TypeScript strict, Tailwind CSS v4),
  déployés séparément sur Vercel.
- **Clés de service configurables au runtime, pas en `.env`** (décidé le
  2026-09-07, sur demande explicite) : R2, Resend, CinetPay ne sont plus des
  variables d'environnement obligatoires au démarrage. Elles se configurent
  depuis le dashboard admin (page Configuration) et sont stockées chiffrées
  (AES-GCM) dans la table `platform_config` — voir `internal/platformconfig`.
  Seuls `DATABASE_URL`, `JWT_SECRET`, `CONFIG_ENCRYPTION_KEY` (déchiffre
  `platform_config`, généré via `openssl rand -base64 32`) et `ADMIN_API_KEY`
  restent obligatoires en env var. Un déploiement sans R2/Resend/CinetPay
  configurés démarre quand même ; les endpoints concernés répondent 503
  (`storage_not_configured`, `email_not_configured`, `payment_not_configured`)
  jusqu'à leur configuration depuis le dashboard.
- **Rate limit configurable par tenant** (`tenants.rate_limit_per_sec` /
  `rate_limit_burst`, défaut 5/20), modifiable via
  `PUT /admin/tenants/{id}/rate-limit` depuis le dashboard admin — plus une
  limite globale fixe pour tous les tenants.
- **Traçage léger du trafic** : chaque requête tenant-scopée est loggée
  (fire-and-forget, `internal/middleware/traffic_log.go`) dans
  `request_logs` (méthode, chemin, statut, durée, si rate-limited).
  Agrégé par `internal/traffic` pour la vue "Trafic" du dashboard admin
  (`GET /admin/traffic`, `/admin/traffic/{tenantID}`). Pas encore de purge
  automatique — `traffic.Service.PurgeOlderThan` existe mais n'est appelée
  par aucun job planifié pour l'instant.
- **Service catalogue optionnel, opt-in par tenant** (décidé le 2026-09-07,
  sur demande explicite — un tenant qui vend déjà via WhatsApp/en boutique
  n'a pas forcément besoin d'un catalogue public). Table `tenant_features`
  (`catalog_enabled`, défaut `false`), activée/désactivée depuis le
  dashboard admin via `PUT /admin/tenants/{id}/features`. Toutes les
  routes catalogue (`internal/catalog`) passent par le middleware
  `requireCatalog` (voir `internal/httpserver/server.go`) qui renvoie un
  403 clair (`catalog_not_enabled`) si le tenant n'a pas activé la
  fonctionnalité. Le tenant peut vérifier son propre statut via
  `GET /features`. Inspiré d'un exemple concret donné par l'utilisateur
  pour HANI'S (produits, tissus, panier, mesures sur-mesure, galerie,
  avis) — voir `internal/catalog/` : `products.go`, `fabrics.go`,
  `customers.go` (+ `measurements`), `cart.go`, `gallery.go`, `reviews.go`.
  `orders` a été étendu (customer_id, fabric_id/fabric_source,
  shipping_address, notes, statuts enrichis) et `order_status_history`
  ajouté pour tracer chaque changement de statut.
- **Catalogue produit générique, pas figé sur la couture** (précisé le
  2026-09-07, juste après le point précédent — l'utilisateur a demandé "les
  deux" entre un catalogue guidé par type de commerce et un catalogue
  100% libre). `products` n'a plus de colonnes dédiées `gender`/`sizes`/
  `colors` : elles vivent dans `products.attributes` (JSONB libre), avec
  `sku`/`stock_quantity` en colonnes propres (assez universels pour être
  utiles à tout secteur). `tenants.business_type` (`couture_sur_mesure` |
  `commerce_general` | `produit_numerique` | `general`, voir
  `internal/tenant/tenant.go` `BusinessType`/`ValidBusinessType`) indique
  seulement au dashboard quelle forme d'`attributes` suggérer par défaut —
  ça ne restreint jamais ce qu'un tenant peut y stocker. Modifiable via
  `PUT /admin/tenants/{id}/business-type`. `fabrics`/`measurements`
  restent des tables séparées (spécifiques sur-mesure) — un tenant
  `commerce_general` ou `produit_numerique` les ignore simplement, elles
  ne sont pas mélangées au modèle produit générique.
- **Authentification admin réelle** (2026-09-07) : comptes super-admin
  individuels (`users.tenant_id IS NULL`, `role = 'super_admin'`) avec
  login/mot de passe, en plus de — pas à la place de — la clé
  `X-Admin-Key` statique. Décision explicite : garder `X-Admin-Key` comme
  secours bootstrap (créer le tout premier compte admin sans être déjà
  connecté) plutôt que de basculer entièrement et risquer un dashboard
  inaccessible sur une base fraîche. Voir `internal/auth/admin.go`
  (`AdminClaims`, distinct de `Claims` — un JWT admin ne doit jamais
  pouvoir s'utiliser comme JWT tenant ni inversement) et
  `httpserver.adminAuth` (accepte JWT admin OU `X-Admin-Key`). Index
  unique partiel ajouté sur `users(email) WHERE tenant_id IS NULL` — la
  contrainte `UNIQUE(tenant_id, email)` seule ne suffit pas, Postgres
  traite chaque `NULL` comme distinct.
  **Pas encore fait : le dashboard admin ne consomme toujours pas ce
  flux (page de gestion des comptes admin, login par formulaire) — reste
  en X-Admin-Key côté frontend.**
- **Authentification des clients finaux d'un tenant** (2026-09-07,
  demandé explicitement pour HANI'S — ex: Fatou qui commande une robe).
  Troisième public JWT, distinct de `Claims` (personnel tenant) et
  `AdminClaims` (super-admin) : voir `internal/auth/customer.go`
  (`CustomerClaims`). Un client existe d'abord sans mot de passe (créé
  automatiquement par `catalog.CustomerService.FindOrCreate` à sa
  première commande) ; `POST /auth/customer/register` lui permet d'en
  définir un a posteriori pour se connecter et consulter son historique.
  Identification principale par téléphone (pas email — cohérent avec le
  reste du modèle `customers`). `customers.password_hash` nullable,
  `customers.email` unique par tenant seulement quand renseigné (index
  partiel, même piège que pour `users` ci-dessus). Mot de passe oublié
  via token à usage unique envoyé par email (`customer_password_resets`,
  seul le hash SHA-256 du token est stocké, jamais le token en clair) —
  la route `forgot-password` répond toujours le même message générique,
  qu'un compte existe ou non, pour ne pas permettre l'énumération
  d'emails. **Vrai logout implémenté** : table `revoked_tokens` (jti +
  expiration) car un JWT classique n'est pas invalidable avant son
  expiration naturelle sans état côté serveur — mécanisme générique,
  réutilisable plus tard pour les JWT tenant/admin si un vrai logout leur
  est demandé (pas fait pour l'instant, seul le flux client l'utilise).
  **Pas encore fait : aucun dashboard/frontend ne consomme ces routes
  (`/auth/customer/*`) — c'est un backend prêt sans interface pour
  l'instant.**
- **Emails transactionnels au-delà du reset de mot de passe** (2026-09-07,
  l'utilisateur a demandé confirmation que "les services de message" sont
  bien gérés pour un tenant). Deux emails ajoutés, tous deux best-effort
  (un échec d'envoi — Resend non configuré, quota épuisé — ne fait jamais
  échouer l'action métier qui le déclenche, seulement loggé via `slog`) :
  - **Bienvenue tenant** : `tenants.contact_email` (nouvelle colonne,
    `internal/tenant.Create` prend maintenant `contactEmail` en paramètre)
    reçoit un email à la création depuis `handleAdminCreateTenant` — ne
    contient JAMAIS la clé secrète (`api_key_secret`), qui reste affichée
    une seule fois dans le dashboard admin uniquement.
  - **Confirmation de commande** : le client final reçoit un email si
    `order.CustomerEmail` est renseigné, déclenché depuis
    `handleCreateOrder` et `handleCreateCustomOrder` via
    `sendOrderConfirmationEmail` (fonction partagée dans
    `internal/httpserver/handlers.go`).
  N'ont PAS été ajoutés (à discuter si besoin) : notification tenant à
  chaque nouvelle commande reçue, email à chaque changement de statut de
  commande, notification quand le quota de stockage/email approche de sa
  limite.

## État d'avancement

### Fait et vérifié
- Backend Go : compile (`go build ./...`), passe `go vet ./...`. **Jamais
  testé contre une vraie base Postgres ni de vraies clés API externes
  (R2/Resend/CinetPay) — seulement vérifié à la compilation.**
- Schéma Postgres + RLS : `migrations/0001_init.sql`.
- Routes HTTP existantes (voir `internal/httpserver/server.go` pour la liste
  exacte et à jour) :
  - `GET /health`
  - `POST /auth/login` (personnel tenant), `POST /admin/auth/login` (super-admin)
  - `POST /auth/customer/register`, `/login`, `/forgot-password`, `/reset-password`
    (clients finaux d'un tenant, identifiés par `tenant_slug` dans le body)
  - Scopées JWT client (`customerAuth`) : `POST /auth/customer/logout`,
    `GET/PATCH /auth/customer/me`
  - `POST /webhooks/cinetpay/{tenantSlug}`
  - Scopées `staffAuth` (`X-API-Key` **ou** JWT staff, voir décisions
    ci-dessus) : `GET /features`, `POST/GET /orders`,
    `GET/PATCH /orders/{id}`, `GET /orders/{id}/history`,
    `POST /custom-orders`, `POST /measurements`, `POST /uploads/image`,
    `POST /payments/init`, `POST /notifications/email`
  - Scopées `staffAuth` + catalogue activé (`requireCatalog`) :
    `GET/POST /products`, `GET /products/{id}`, `GET/POST /fabrics`,
    `POST /fabrics/upload`, `GET/POST /gallery`, `GET/POST /cart`,
    `DELETE /cart/{itemID}`, `POST /reviews`, `GET /reviews`,
    `GET /reviews/pending`, `POST /reviews/{id}/publish`
  - Scopées `staffAuth` + JWT staff obligatoire (`requireStaffJWT`, pas
    de repli `X-API-Key` — une intégration externe n'a pas d'identité
    humaine) : `POST /auth/logout`, `GET/POST /staff`,
    `PUT /staff/{userID}/active`
  - `POST /admin/auth/login` (email/mot de passe super-admin -> JWT)
  - Scopées `adminAuth` (JWT admin **ou** `X-Admin-Key` en secours
    bootstrap) : `GET/POST /admin/accounts`,
    `PUT /admin/accounts/{userID}/active`, `GET/POST /admin/tenants`,
    `PUT /admin/tenants/{id}/rate-limit`,
    `PUT /admin/tenants/{id}/business-type`,
    `GET/PUT /admin/tenants/{id}/features`, `GET /admin/config`,
    `PUT /admin/config/{key}`, `GET /admin/traffic`,
    `GET /admin/traffic/{tenantID}`
- `admin-dashboard/` : build de production (`npm run build`) et lint
  (`npm run lint`) passent sans erreur ni avertissement. Fonctionnalités :
  connexion par clé admin, tableau des tenants avec jauge de stockage,
  création de tenant avec affichage unique de la clé secrète.
- `tenant-dashboard/` : créé (connexion par clé API, commandes avec mesures
  sur-mesure, upload photos, initiation paiement CinetPay, page paramètres).
  **Le build de ce dashboard n'a pas encore été confirmé dans cette
  conversation — vérifier `npm run build` avant de le considérer stable.**
- `k8s/` : manifests k3s complets (namespace, StatefulSet Postgres, Deployment
  API 2 réplicas, Service, Ingress Traefik + cert-manager, secrets exemple,
  kustomization, README avec commandes d'installation VPS). YAML validé
  syntaxiquement, jamais appliqué sur un vrai cluster.

### Pas encore fait
- `internal/catalog/` — package vide. Le catalogue produits (CRUD produits,
  collections, tailles/couleurs, prévu dans le plan d'origine) n'est pas
  implémenté. Les uploads d'images existent (`internal/storage`) mais rien ne
  les rattache encore à un vrai modèle Produit.
- Aucun test automatisé (unit/integration) n'existe encore pour le backend Go.
- Le JWT émis par `/auth/login` (voir `internal/auth/service.go`) n'est
  consommé par aucune route protégée pour l'instant — les routes métier
  utilisent `X-API-Key`, pas le JWT. À clarifier si un vrai système
  utilisateur (multi-comptes par tenant, rôles staff/owner) est voulu, ou si
  `X-API-Key` seul suffit pour le tenant-dashboard.
- Déploiement réel jamais effectué : ni k3s sur le VPS, ni les dashboards sur
  Vercel, ni les vraies clés API (R2/Resend/CinetPay) configurées et
  testées.
- DNS / domaines (`cors.abmcy.com`, `dash.abmcy.com`) pas encore configurés
  côté registrar.

## Pièges connus / à ne pas refaire

- Le fichier `cors pr` à la racine est un fichier vide préexistant de
  l'utilisateur — ne pas le supprimer sans demande explicite (une tentative de
  nettoyage a déjà été bloquée par le mode auto).
- Ne jamais committer de vraies clés API dans `.env`, `k8s/secrets-example.yaml`
  ou ailleurs — ces fichiers sont des modèles avec des placeholders.
- L'utilisateur écrit en français avec beaucoup de fautes de frappe /
  phonétique (mélange français/wolof probable) — lire attentivement l'intent
  plutôt que le texte littéral, et confirmer par une question courte en cas de
  doute réel sur une décision structurante.

## Prochaines étapes probables

L'utilisateur a demandé (2026-09-07) une suite de fonctionnalités à traiter
**une par une, dans cet ordre de priorité qu'il a validé** — ne pas sauter
d'étape ni tout lancer en parallèle sans validation :
1. ~~Confirmer le build de `tenant-dashboard/`~~ — fait, build + lint propres.
2. ~~Construire `landing/`~~ — fait, animation d'architecture au scroll.
3. ~~Config R2/Resend/CinetPay dynamique + rate-limit par tenant + traçage
   du trafic~~ — fait, backend (`go build`/`go vet` OK) et dashboard admin
   (`admin-dashboard/app/services`, `admin-dashboard/app/trafic` +
   `/trafic/[tenantId]`, édition rate-limit dans TenantsTable) — build +
   lint confirmés deux fois (agent puis vérification indépendante).
4. ~~Service catalogue optionnel (produits, tissus, panier, mesures,
   galerie, avis), opt-in par tenant, rendu générique (pas figé sur la
   couture, business_type indicatif seulement) — dashboards tenant et
   admin connectés~~ — **fait de bout en bout (2026-09-07)** : backend
   (`go build`/`go vet` OK), dashboard admin (sélecteur business_type +
   interrupteur "Catalogue activé" par tenant dans `TenantsTable`), et
   dashboard tenant (pages `/catalogue`, `/tissus`, `/galerie`, `/avis`,
   navigation conditionnée à `GET /features`, détail commande enrichi
   avec historique de statut). Build + lint confirmés (agent puis
   vérification indépendante) pour les deux dashboards.
5. ~~Authentification admin réelle~~ — fait côté backend (2026-09-07,
   voir section décisions ci-dessus) : `go build`/`go vet` OK.
   **Le dashboard admin ne consomme pas encore `POST /admin/auth/login`
   ni les routes `/admin/accounts` — toujours en `X-Admin-Key` côté
   frontend pour l'instant. Logout/mot de passe oublié pas implémentés.**
6. ~~Authentification client final (acheteurs des tenants, ex: clients de
   HANI'S)~~ — **fait côté backend (2026-09-07)**, voir section décisions
   ci-dessus (`internal/auth/customer.go`, routes `/auth/customer/*`).
   `go build`/`go vet` OK. **Aucun frontend ne consomme encore ces
   routes** — ni un futur site storefront public pour les clients de
   HANI'S (n'existe pas), ni le tenant-dashboard (qui reste un outil pour
   le personnel, pas pour les clients finaux).
7. ~~Personnel tenant : comptes individuels login/mot de passe~~ — **fait
   côté backend (2026-09-07)**. Décision explicite : `X-API-Key` reste
   réservée à l'intégration technique externe (ex: le site de HANI'S) —
   pas de repli temporaire ici comme pour l'admin, c'est une séparation
   d'usage durable. Toutes les routes tenant-scopées (`/orders`,
   `/products`, etc.) acceptent maintenant **soit** `X-API-Key` **soit**
   un JWT staff (`httpserver.staffAuth`, distingue les deux par la
   présence de deux points `.` dans le Bearer token — un JWT en a
   toujours exactement deux, une clé `pk_live_...` jamais). Nouveau :
   - `tenant.Service.Create` crée maintenant, dans la même opération, le
     premier compte `owner` du tenant (email/mot de passe fournis par
     l'admin ABMCY à la création) — **sans ça, personne n'aurait jamais
     pu se connecter par mot de passe sur un nouveau tenant**, trou
     détecté et comblé avant de brancher les routes staff.
   - `internal/auth/service.go` : `Logout` (révocation par jti, même
     mécanisme que `LogoutCustomer`), `CreateStaffUser`/`ListStaffUsers`/
     `SetStaffUserActive` (gestion d'équipe, réservée au rôle `owner`
     — vérifié dans les handlers, pas dans le service).
   - Nouvelles routes tenant-scopées, réservées au JWT staff
     (`requireStaffJWT` — une intégration `X-API-Key` n'a pas d'identité
     humaine à révoquer ni de droit à accorder) : `POST /auth/logout`,
     `GET/POST /staff`, `PUT /staff/{userID}/active`.
   `go build`/`go vet` OK. **Le dashboard admin ne demande pas encore
   l'email/mot de passe du propriétaire à la création d'un tenant, et
   `tenant-dashboard/` utilise toujours `X-API-Key` — aucun frontend ne
   consomme encore ce nouveau flux.**
8. Monitoring + alertes de sécurité (email en cas d'anomalie : pics
   d'erreurs, échecs de connexion répétés, quota dépassé) — pas commencé.
9. Sitemap XML (référencement `landing/`) + flux XML produits par tenant
   (type Google Shopping) — pas commencé.
10. Déploiement réel : k3s sur le VPS + vraies clés + DNS (4 sous-domaines
    `.abmcy.com` à pointer : `api`, `ad`, `dash`, `core`).

Dépôt Git initialisé le 2026-09-07 (`git init`, commits réguliers depuis) —
pas encore de remote GitHub configuré par l'utilisateur à cette date.
