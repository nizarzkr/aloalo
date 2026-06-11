# Aloalo

SaaS d'intelligence commerciale qui se branche via API sur la téléphonie d'entreprise
(Ringover, Aircall) : transcrit les appels, les analyse via IA, et génère des scores de
performance et des conseils de coaching automatique.

> **Note framework** — ce dépôt utilise une version modifiée de Next.js (voir l'en-tête
> d'`AGENTS.md`). Les conventions et APIs peuvent différer de Next.js standard ; lire
> `node_modules/next/dist/docs/` avant d'écrire du code qui touche au framework.

## Stack

Next.js 16.2.4 (App Router) + React 19.2 + TypeScript + Tailwind v4 + shadcn/ui ·
Supabase (Postgres + Auth, région **West EU / Paris**) · AssemblyAI (transcription, EU) ·
Claude Haiku 4.5 (analyse IA) · Stripe (paiement) · Resend (email) · Vercel (hébergement).

## Prérequis

- Node ≥ 20
- npm
- Un projet Supabase (région West EU / Paris)

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis remplir chaque clé (voir .env.example pour le détail de chaque variable)
npm run dev                  # http://localhost:3000
```

Scripts disponibles (cf. `package.json`) :

```bash
npm run dev      # serveur de développement
npm run build    # build de production
npm run start    # sert le build de production
npm run lint     # ESLint
npm run test     # tests (vitest)
```

## Variables d'environnement

**`.env.example` est la source de vérité** : chaque variable y est documentée (rôle,
côté serveur/navigateur, comment la générer). Copier ce fichier en `.env.local` et
renseigner chaque clé.

Règle de sécurité (cf. `AGENTS.md`) :

- Les clés `NEXT_PUBLIC_*` et `*_PUBLISHABLE_KEY` sont **safe côté navigateur**.
- Toutes les autres (`*_SECRET_KEY`, `ANTHROPIC_API_KEY`, etc.) restent **côté serveur
  uniquement** (Server Components, Server Actions, Route Handlers).
- **`.env.local` n'est JAMAIS committé** (couvert par `.gitignore`).

## Base de données / migrations

Le schéma est défini par des migrations SQL numérotées dans
`supabase/migrations/NNNN_description.sql`, **appliquées dans l'ordre**. Elles sont
l'**unique source de vérité** du schéma `public.*` : jamais de changement de schéma dans
la console Supabase sans migration numérotée correspondante (sinon dérive silencieuse).

Le prochain numéro libre est déterminé par le fichier existant le plus haut
(actuellement `0022` → le prochain est **`0023`**).

Procédures de **sauvegarde / restauration / rollback de migration** :
voir [`supabase/RUNBOOK.md`](supabase/RUNBOOK.md).

## Déploiement Vercel

Le déploiement se fait par push sur `main` → build Vercel automatique.

Régler **chaque variable** de `.env.example` dans Vercel (Settings → Environment
Variables), scopes **Production + Preview**.
