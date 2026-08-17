# Aloalo — Conversation intelligence pour équipes commerciales

**Un outil qui écoute les appels commerciaux, les analyse, et rend au manager la matière factuelle dont il a besoin pour coacher — puis renvoie tout dans le CRM déjà en place.**

Cible : PME et startups françaises de 5 à 50 commerciaux, qui n'ont ni Rev Ops dédié ni temps de coaching structuré.

> Produit conçu, spécifié et construit de bout en bout par [@nizarzkr](https://github.com/nizarzkr). Le code a été écrit avec Claude Code ; les décisions produit, l'architecture fonctionnelle, le modèle de données et le go-to-market sont les miennes.

---

## Le problème

Dans une équipe commerciale, l'essentiel de l'information client se joue à l'oral. Cette matière est rarement réexploitée, parce que la retranscrire et l'analyser à la main coûte un temps que personne n'a.

| Rôle | Ce qui coince aujourd'hui |
|---|---|
| **Commercial** | Prise de notes et mise à jour CRM post-appel chronophages. Des next steps se perdent quand l'agenda se charge. |
| **Manager** | Peu de matière factuelle pour préparer un 1:1 utile. Il coache sur les chiffres de résultat et sur ce que le commercial lui rapporte — rarement sur ce qui s'est réellement dit. |
| **Rev Ops / dir. commercial** | Pilote un pipe qualifié de façon déclarative (« ce deal avance bien »), impossible à objectiver sans écouter les appels un par un. |

## La proposition de valeur

Rendre automatiquement exploitable ce qui se dit dans les conversations commerciales.

Formulé côté client : **un appui Rev Ops et coaching que la PME peut s'offrir avant d'avoir les moyens de recruter ces profils à temps plein.**

## Ce que fait le produit

Le produit est organisé en trois actes, chacun adressant un persona.

### 1. Analyser — le commercial gagne du temps

- Note de synthèse générée après l'appel, sans une minute de saisie.
- Tâches de suivi proposées avec une échéance **contextualisée** (pas un rappel générique), regroupées dans une file « À faire » cochable.
- Suggestion de prochaine étape, et points de suivi prêts à reprendre dans l'email de relance.
- Notes et tâches poussées automatiquement dans **HubSpot** ou **Pipedrive**, sur le bon contact et le bon deal.

### 2. Piloter — objectiver la santé du pipe

- Signaux de risque calculés sur ce qui s'est dit, pas sur ce qui a été déclaré.
- Alerte sur les deals qui décrochent, avec une piste d'action prête à pousser en tâche.

### 3. Coacher — appuyer le manager sur des faits

- Analyse de l'appel **par dimensions** (découverte, objections, prochaine étape…), chacune marquée validé / partiel / manqué **et justifiée par une citation de l'appel**.
- Métriques de dynamique calculées **sans IA**, donc non contestables : temps de parole, alternance des tours de parole, plus long monologue, rapidité de passage au pitch.
- Signaux comportementaux : questions ouvertes vs fermées, réaction au prix, gestion du silence après une objection.
- **Briefing « Préparer un 1:1 »** généré avant l'entretien : progrès, points récurrents, sur quoi insister — au ton bienveillant.
- **Profil de coaching** par commercial, qui agrège ses tendances dans le temps.

> Objectif visé : un 1:1 préparé en 2 minutes au lieu de 30, ancré sur des moments précis d'appels réels plutôt que sur une impression.

## Décisions produit notables

Quelques arbitrages qui expliquent la forme du produit :

- **Se brancher sur le CRM existant plutôt que le remplacer.** Aucune équipe ne migre son CRM pour un outil de coaching. Aloalo écrit dans HubSpot / Pipedrive et n'essaie pas de devenir la source de vérité.
- **Les métriques de dynamique sont calculées sans IA.** Un manager peut contester un score généré par un modèle ; il ne peut pas contester un temps de parole mesuré. C'est ce qui rend la conversation de coaching possible.
- **Chaque jugement de l'IA est justifié par une citation.** Sans preuve extraite de l'appel, le commercial rejette l'analyse — et l'adoption tombe à zéro.
- **Hébergement et traitement en Europe** (Supabase West EU / Paris, AssemblyAI EU) : prérequis non négociable pour vendre à des PME françaises qui enregistrent des conversations client.

Le raisonnement complet — discovery, JTBD, analyse concurrentielle, et la critique des hypothèses par un avocat du diable — est documenté dans un dépôt séparé : **[sales-discovery-aloalo](https://github.com/nizarzkr/sales-discovery-aloalo)**.

Le positionnement go-to-market détaillé est dans [`BRIEF_GTM.md`](./BRIEF_GTM.md).

---

## Périmètre technique

Application multi-tenant avec authentification, invitations d'équipe, rôles, facturation et onboarding.

| Domaine | Détail |
|---|---|
| **Front / framework** | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui |
| **Données & auth** | Supabase (Postgres + Auth + RLS), région West EU / Paris |
| **Transcription** | AssemblyAI (région EU) |
| **Analyse IA** | Claude Haiku 4.5 |
| **Téléphonie / visio** | Ringover, Aircall, Google Meet |
| **CRM** | HubSpot, Pipedrive |
| **Facturation & email** | Stripe, Resend |
| **Hébergement** | Vercel |

Le schéma est piloté par 36 migrations SQL numérotées avec RLS par organisation, l'isolation des données entre clients étant la contrainte structurante de l'app.

> **Note framework** — ce dépôt utilise une version modifiée de Next.js (voir l'en-tête d'[`AGENTS.md`](./AGENTS.md)). Les conventions peuvent différer de Next.js standard.

### Démarrage local

```bash
npm install
cp .env.example .env.local   # puis remplir chaque clé (chaque variable est documentée dans .env.example)
npm run dev                  # http://localhost:3000
```

Autres scripts : `npm run build`, `npm run start`, `npm run lint`, `npm run test` (vitest).

### Variables d'environnement

**`.env.example` est la source de vérité** : chaque variable y est documentée (rôle, côté serveur ou navigateur, comment la générer).

Règle de sécurité (cf. [`AGENTS.md`](./AGENTS.md)) :

- Les clés `NEXT_PUBLIC_*` et `*_PUBLISHABLE_KEY` sont **safe côté navigateur**.
- Toutes les autres (`*_SECRET_KEY`, `ANTHROPIC_API_KEY`…) restent **côté serveur uniquement** (Server Components, Server Actions, Route Handlers).
- **`.env.local` n'est jamais committé** (couvert par `.gitignore`).

### Base de données et migrations

Le schéma est défini par des migrations SQL numérotées dans `supabase/migrations/NNNN_description.sql`, **appliquées dans l'ordre**. Elles sont l'**unique source de vérité** du schéma `public.*` : aucun changement de schéma dans la console Supabase sans migration numérotée correspondante, sinon dérive silencieuse.

Le prochain numéro libre est déterminé par le fichier existant le plus haut.

Sauvegarde, restauration et rollback de migration : voir [`supabase/RUNBOOK.md`](supabase/RUNBOOK.md).

### Déploiement

Push sur `main` → build Vercel automatique. Chaque variable de `.env.example` doit être réglée dans Vercel (Settings → Environment Variables), scopes **Production + Preview**.

---

## Documentation du dépôt

| Fichier | Contenu |
|---|---|
| [`BRIEF_GTM.md`](./BRIEF_GTM.md) | Positionnement, personas, problème → bénéfice → feature |
| [`AGENTS.md`](./AGENTS.md) | Conventions techniques et règles de sécurité |
| [`ISSUES_TRACKER.md`](./ISSUES_TRACKER.md) | Suivi des bugs et dette |
| [`demo-script.md`](./demo-script.md) | Script de démo produit |
| [`docs/`](./docs/) | Notes d'architecture et de décision |
