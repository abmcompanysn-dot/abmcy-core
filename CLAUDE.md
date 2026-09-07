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

## État d'avancement

### Fait et vérifié
- Backend Go : compile (`go build ./...`), passe `go vet ./...`. **Jamais
  testé contre une vraie base Postgres ni de vraies clés API externes
  (R2/Resend/CinetPay) — seulement vérifié à la compilation.**
- Schéma Postgres + RLS : `migrations/0001_init.sql`.
- Routes HTTP existantes (voir `internal/httpserver/server.go` pour la liste
  exacte et à jour) :
  - `GET /health`
  - `POST /auth/login`
  - `POST /webhooks/cinetpay/{tenantSlug}`
  - Scopées `X-API-Key` : `POST/GET /orders`, `POST /uploads/image`,
    `POST /payments/init`, `POST /notifications/email`
  - Scopées `X-Admin-Key` : `GET/POST /admin/tenants`
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

À proposer/discuter avec l'utilisateur plutôt qu'à supposer :
1. ~~Confirmer le build de `tenant-dashboard/`~~ — fait, build + lint propres.
2. Construire `landing/` (site vitrine Next.js sur `core.abmcy.com`) avec une
   animation de blocs qui se construisent pour visualiser l'architecture —
   demandé explicitement, pas encore commencé.
3. Implémenter `internal/catalog/` (produits/collections) si le dashboard
   tenant doit vraiment gérer un catalogue (actuellement il ne gère que
   commandes + photos brutes).
4. Décider du sort du JWT (`/auth/login`) vs clé API pour l'auth tenant.
5. Déploiement réel : k3s sur le VPS + vraies clés + DNS (3 sous-domaines
   `.abmcy.com` à pointer : `api`, `ad`, `dash`, `core`).
6. Initialiser un dépôt Git (`git init`) — pas encore fait, nécessaire avant
   de connecter Vercel pour un déploiement automatique par push.
