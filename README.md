# ABMCY Core Multi-Tenant

Backend SaaS/BaaS multi-tenant en Go pour ABMCY. Chaque client (ex: HANI'S) est un
"tenant" isolé (données, quota de stockage, quota d'emails) sur une infrastructure
partagée.

## Architecture

- **Backend** : Go (modulith — un seul binaire, packages séparés dans `internal/`),
  Postgres avec Row Level Security pour l'isolation entre tenants. Déployé sur un
  VPS (4 CPU / 6 Go RAM) derrière `api.abmcy.com`.
- **Dashboard super-admin** (`admin-dashboard/`) : Next.js, utilisé par l'équipe
  ABMCY pour gérer tous les tenants (création, quotas, suivi de consommation).
  Déployé sur Vercel sous `ad.abmcy.com`.
- **Dashboard tenant** (`tenant-dashboard/`) : Next.js, utilisé par chaque client
  (ex: HANI'S) pour gérer ses commandes, uploader ses photos produits, initier des
  paiements. Déployé sur Vercel sous `dash.abmcy.com`.
- **Site vitrine** (`landing/`) : présente le projet ABMCY Core, déployé sur Vercel
  sous `cors.abmcy.com`.
- **Images** : uploadées vers un bucket [Cloudflare R2](https://developers.cloudflare.com/r2/)
  (compatible S3, sans frais de sortie), servies via un domaine public dédié
  (`img.abmcy.com`). On garde juste l'URL + le poids en base.
- **Emails** : envoyés via [Resend](https://resend.com/), quota strict de 100/jour
  par tenant, appliqué côté serveur.
- **Paiements** : [CinetPay](https://cinetpay.com/) (agrège Wave, Orange Money, MTN
  MoMo, cartes bancaires).
- **Orchestration** : Kubernetes léger ([k3s](https://k3s.io/)) sur le VPS — voir
  `k8s/README.md`. Un `docker-compose.yml` reste disponible en solution de repli /
  pour du développement local rapide.

Voir [CLAUDE.md](./CLAUDE.md) pour le détail complet de l'état du projet,
les décisions prises et ce qu'il reste à faire.

## Structure du dépôt

```
cmd/api/main.go          Point d'entrée du binaire Go, assemble tous les services
internal/
  config/                 Chargement des variables d'environnement
  db/                      Pool Postgres (pgx) + isolation tenant via RLS
  middleware/              Auth par clé API, rate limiting par tenant
  tenant/                  Gestion des tenants (créé/listé par le super-admin)
  auth/                    Login JWT scopé par tenant
  order/                   Commandes + mesures sur-mesure
  storage/                 Upload d'images vers Cloudflare R2 + suivi du quota
  payment/                 Intégration CinetPay
  notification/            Envoi d'emails via Resend + quota journalier
  catalog/                 (vide — catalogue produits pas encore implémenté)
  httpserver/               Routes HTTP et handlers (chi router)
pkg/
  apierror/                Erreurs API uniformes
  response/                Helpers de réponse JSON
migrations/0001_init.sql  Schéma Postgres complet + policies RLS
admin-dashboard/          Dashboard super-admin (Next.js) -> ad.abmcy.com
tenant-dashboard/         Dashboard client/tenant (Next.js) -> dash.abmcy.com
landing/                  Site vitrine du projet (Next.js) -> cors.abmcy.com
k8s/                       Manifests Kubernetes (k3s) pour le déploiement VPS
deploy/Caddyfile           Config reverse-proxy alternative (si k3s n'est pas utilisé)
docker-compose.yml         Déploiement local/simple (alternative à k8s/)
```

## Démarrage rapide (développement local)

```bash
cp .env.example .env   # remplir DATABASE_URL, JWT_SECRET, R2_*, etc.
go mod tidy
go build ./...
go run ./cmd/api
```

Le backend nécessite une base Postgres avec `migrations/0001_init.sql` appliqué.
Le moyen le plus simple en local reste `docker compose up -d`.

Pour chaque dashboard :

```bash
cd admin-dashboard    # ou tenant-dashboard
cp .env.example .env.local
npm install
npm run dev
```

## Déploiement

- **Backend** : voir `k8s/README.md` pour le déploiement k3s sur le VPS (recommandé),
  ou `docker compose up -d` pour une alternative plus simple.
- **Dashboards et vitrine** : `vercel --prod` depuis `admin-dashboard/`,
  `tenant-dashboard/` et `landing/`, avec `NEXT_PUBLIC_API_URL` configuré sur les
  env vars Vercel (dashboards uniquement). Un projet Vercel séparé par dossier,
  chacun avec son propre domaine (`ad.`, `dash.`, `core.` .abmcy.com).
