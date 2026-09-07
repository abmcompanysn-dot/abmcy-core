# ABMCY Core — Site vitrine

Site vitrine (une page) présentant ABMCY Core, plateforme SaaS multi-tenant
pour digitaliser les commerçants et artisans ouest-africains. Next.js 16 (App
Router), TypeScript strict, Tailwind CSS v4, animations via Framer Motion.

Destiné à être déployé sous `core.abmcy.com`.

## Développement local

```bash
npm install
npm run dev
```

Le site est alors disponible sur http://localhost:3000.

## Build de production

```bash
npm run build
npm run start
```

## Lint

```bash
npm run lint
```

## Déploiement (Vercel)

```bash
vercel --prod
```

Une fois le projet créé sur Vercel, configurer le domaine personnalisé dans
**Project Settings → Domains** en y ajoutant `core.abmcy.com`, puis pointer le
DNS du domaine (enregistrement CNAME ou A selon les instructions Vercel) chez
le registrar.

Ce site est statique (aucune variable d'environnement requise) : pas de
`.env` à configurer pour le déploiement.

## Structure

```
app/
  layout.tsx        Layout racine, polices, métadonnées SEO/Open Graph
  page.tsx           Page unique : Header, Hero, Architecture, Fonctionnalités, Footer
  globals.css        Tailwind v4 + keyframes des animations
components/
  Header.tsx                 Barre de navigation
  Hero.tsx                    Section d'accroche
  ArchitectureAnimation.tsx   Schéma animé de l'architecture (blocs + connexions SVG)
  Features.tsx                 Cartes de fonctionnalités
  Footer.tsx                   Pied de page
lib/
  use-in-view.ts     Hook IntersectionObserver pour déclencher les animations au scroll
```
