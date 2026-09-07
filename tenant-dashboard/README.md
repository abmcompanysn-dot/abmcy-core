# ABMCY Tenant Dashboard

Dashboard client pour un tenant ABMCY (ex. HANI'S). Permet de se
connecter avec la clé API du tenant (`X-API-Key`), de gérer les
commandes (création, mesures sur-mesure, initiation de paiement
CinetPay), d'envoyer des photos produits/tissus, et de vérifier la
disponibilité de l'API.

Ce dashboard est une application Next.js indépendante, destinée à être
déployée séparément (par exemple sur Vercel, sous un domaine du type
`dash.abmcy.com`) — elle ne fait pas partie du backend Go et
communique avec lui uniquement via son API HTTP.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

Par défaut, l'application appelle `https://api.abmcy.com`. Pour pointer
vers une autre API (par exemple en local), copiez `.env.example` vers
`.env.local` et ajustez la valeur :

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

La clé API n'est jamais codée en dur : elle est saisie dans l'écran de
connexion et stockée uniquement dans le `localStorage` du navigateur.

## Déployer sur Vercel

```bash
vercel --prod
```

Avant le déploiement (ou dans les paramètres du projet sur
vercel.com), pensez à configurer la variable d'environnement
`NEXT_PUBLIC_API_URL` avec l'URL de l'API backend en production
(ex. `https://api.abmcy.com`) dans **Project Settings → Environment
Variables**, puis redéployez si vous l'ajoutez après le premier déploiement.

Ce dashboard est destiné au sous-domaine `dash.abmcy.com` (voir **Project
Settings → Domains** sur Vercel une fois le projet créé).

## Build de production

```bash
npm run build
npm run start
```
