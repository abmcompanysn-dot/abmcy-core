# MAHU Web

Site public d'actualités MAHU. Application Next.js indépendante, qui lit
les articles publiés d'un tenant ABMCY Core via ses routes publiques
(`GET /public/{tenantSlug}/articles`, `GET /public/{tenantSlug}/articles/{id}`,
`POST /public/{tenantSlug}/articles/{id}/view`) — aucune authentification,
c'est un site public en lecture seule.

Remplace l'ancien site `MAHU-NEW/` (HTML/JS vanilla + Google Apps Script) :
plus de backend Google Sheets, plus de contenu factice (images placeholder,
compteurs de vues simulés, analytics codées en dur) — toutes les données
viennent du backend Go ABMCY Core.

Ce site ne gère pas la création/édition d'articles (réservé au personnel
tenant via l'API staff, `POST/PATCH /articles` — voir le backend) ni les
commentaires/newsletter, non encore implémentés côté ABMCY Core.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

Par défaut, l'application appelle `https://api.abmcy.com` et lit le tenant
`mahu`. Pour pointer vers une autre API ou un autre tenant (par exemple en
local), copiez `.env.example` vers `.env.local` et ajustez :

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_TENANT_SLUG=mahu
```

Le tenant `mahu` doit exister côté backend (créé depuis admin-dashboard),
avec `content_enabled` activé (`business_type = "media"` l'active par
défaut) et au moins un article publié pour voir quelque chose s'afficher.

## Déployer sur Vercel

```bash
vercel --prod
```

Avant le déploiement (ou dans les paramètres du projet sur vercel.com),
configurez `NEXT_PUBLIC_API_URL` et `NEXT_PUBLIC_TENANT_SLUG` dans
**Project Settings → Environment Variables**, puis redéployez si vous les
ajoutez après le premier déploiement.

## Build de production

```bash
npm run build
npm run lint
```
