<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Projet Aloalo

## Pitch
SaaS d'intelligence commerciale qui se branche via API sur la téléphonie d'entreprise (Ringover, Aircall). Transcrit les appels, les analyse via IA, génère scores de performance et conseils de coaching automatique.

## Cible
Startups et PME françaises (5–50 commerciaux) utilisant Ringover ou Aircall.

## Founder
Nizar — sans compétences techniques. Apprend à piloter une IA qui code en construisant ce SaaS. Toujours expliquer pédagogiquement les concepts, sans jargon non défini, et demander avant de deviner sur les choix structurants.

---

## Stack technique (figée)

- **Frontend** : Next.js 16.2.4 (App Router) + React 19.2 + TypeScript + Tailwind v4 + shadcn/ui
- **Backend** : Next.js API Routes / Server Actions
- **Auth + DB** : Supabase, région **West EU (Paris)**, projet `kynqancfanvekodbhukd`
- **Transcription** : AssemblyAI (région EU, modèle Universal-2, diarisation native)
- **Analyse IA** : Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Paiement** : Stripe (test pour le MVP)
- **Email** : Resend
- **Hosting** : Vercel (Hobby)
- **Téléphonie** : Ringover (Aircall en alt) — accès API en validation

---

## Conventions du repo (à respecter)

- **Pas de `src/`** — convention plate. `app/`, `lib/`, `components/` à la racine.
- **Alias `@/*` pointe sur `./*`** (cf. `tsconfig.json`). Ex : `@/lib/supabase/server`.
- **Migrations SQL** dans `supabase/migrations/NNNN_description.sql` (numérotées).
- **Composants UI** : shadcn dans `components/ui/`. Ajouter via `npx shadcn@latest add <component>`.
- **Code en anglais**, **libellés UI en français**.
- **Server Actions privilégiées** sur les API Routes pour les formulaires.

---

## Sécurité (non négociable)

- **`.env.local` JAMAIS committé** (`.gitignore` ligne `.env*` couvre ça).
- Clés `NEXT_PUBLIC_*` ou `*_PUBLISHABLE_KEY` → safe côté navigateur.
- Toutes les autres (`*_SECRET_KEY`, `ANTHROPIC_API_KEY`, etc.) → **uniquement côté serveur** (Server Components, Server Actions, Route Handlers).
- **RLS activée sur toutes les tables `public.*`**. Les users LISENT (clé publishable + JWT). Le serveur ÉCRIT (secret key bypass RLS).
- Données utilisateurs en Europe (Supabase Paris, AssemblyAI EU).

---

## Variables d'env (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://kynqancfanvekodbhukd.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
ASSEMBLYAI_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=https://...   # base URL utilisée pour les liens d'invitation (J8)
UPSTASH_REDIS_REST_URL=https://...upstash.io   # rate limiting (J13)
UPSTASH_REDIS_REST_TOKEN=...                    # rate limiting (J13)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...   # observability (J13) — public par design
SENTRY_AUTH_TOKEN=sntrys_...                       # upload source maps au build (Vercel uniquement)
SENTRY_ORG=aloalo                                   # slug de l'organisation Sentry
SENTRY_PROJECT=aloalo-slug                          # slug du projet Sentry
HUBSPOT_APP_CLIENT_SECRET=...                       # client secret de l'App Card HubSpot (UI Extension) — vérifie la signature X-HubSpot-Signature-v3 des requêtes hubspot.fetch() vers /api/hubspot/card-data. Récupérable dans les réglages d'auth de l'app HubSpot. (Remplace l'ancien HUBSPOT_CARD_SECRET, abandonné avec la fonction serverless.)
ORG_SECRETS_ENC_KEY=base64(32 octets)               # chiffre au repos les credentials tiers (ringover_api_key, hubspot_token) via AES-256-GCM — cf. lib/crypto/org-secrets.ts (issue #5). SERVER-ONLY / Vercel-only (tous environnements). Générer avec `openssl rand -base64 32`. Si absente, toute (dé)chiffrement échoue → pipeline cassé : à régler AVANT de déployer la migration 0017.
```

Ajouts prévus : `STRIPE_WEBHOOK_SECRET` (J9), `RINGOVER_WEBHOOK_SECRET` (J3).

---

## Modèle de données (cf. `supabase/migrations/`)

6 tables dans `public` :
- `organizations` — racine du tenant (1 org = 1 compte client Aloalo)
- `profiles` — `id = auth.users.id`, lié à une org, role `owner`/`manager`/`sales`
- `calls` — appels Ringover/Aircall/simulés, pipeline `pending → transcribing → analyzed`
- `analyses` — résultat IA d'un appel (1-to-1 avec `calls`), scores + conseils
- `usage_logs` — coûts API par org (AssemblyAI, Anthropic, Resend)
- `invitations` — liens magiques pour rejoindre une org (J8 étape 2)
  - `token text` (et non `uuid`) — hex 32 chars sans tirets, généré par DB
  - À l'invitation, `role` ∈ `{'manager', 'sales'}` (un owner ne s'auto-réplique pas)

Trigger `on_auth_user_created` (fonction `public.handle_new_user`) : à chaque signup `auth.users`, crée auto une org + un profile owner. Les valeurs `full_name` et `organization_name` viennent de `raw_user_meta_data` envoyé par le formulaire signup côté Next.js.

Helper RLS : `public.user_organization_id()` (SECURITY DEFINER) — renvoie l'org_id du user JWT, à utiliser dans les policies pour éviter la récursion.

---

## État d'avancement

- **J1 ✅** — Setup Vercel, Supabase, comptes, landing page, .env.local
- **J2 (en cours)** — Auth + DB :
  - ✅ Tables, RLS, trigger signup créés en DB
  - ✅ `lib/supabase/client.ts` (browser) + `lib/supabase/server.ts` (server) créés
  - ⏳ Pages `/signup` et `/login` avec Server Actions à coder
  - ⏳ Middleware `middleware.ts` pour protéger `/dashboard/*`
  - ⏳ Dashboard vide avec sidebar
- **J3 → J14** — voir `~/Desktop/CLAUDE/Aloalo/_state/programme.md` (hors repo)

---

## Workflow attendu

1. **Avant de proposer une grosse modif structurelle** (changer un dossier, renommer un fichier qui touche plusieurs imports, modifier la stack), demander confirmation.
2. **Lire les conventions** (ce fichier) avant d'écrire du code.
3. **Toujours préférer** `Edit` sur des fichiers existants plutôt que créer des doublons.
4. **Commenter en français** les décisions non-évidentes.
5. **Ne jamais committer `.env.local`** ni n'importe quel secret.

---

## Commande « ship la prochaine issue »

Quand Nizar dit **« ship la prochaine issue »** (ou une formulation équivalente, sans donner de numéro), appliquer cette procédure exacte :

1. **Identifier l'issue.** Ouvrir `ISSUES_TRACKER.md` à la racine et prendre la **première case non cochée** (`- [ ]`) dans l'ordre du fichier — c'est l'issue à traiter. Confirmer le numéro à Nizar en une ligne. Ne jamais sauter de ligne ni changer l'ordre.
2. **Lire l'issue** sur GitHub avec `gh issue view <N>` pour avoir le détail complet (fichiers, fix, critères d'acceptation).
3. **Mode plan.** Proposer un plan à Nizar et le débriefer avec lui. Ne rien modifier tant qu'il n'a pas validé le plan.
4. **Exécuter** une fois le plan validé : coder, tester.
5. **Commit directement sur `main`** (workflow choisi par Nizar : pas de Pull Request). Message de commit en français, terminé par la ligne `Co-Authored-By`. Référencer l'issue dans le message (ex. `Closes #N`).
6. **Avant de terminer**, cocher la case correspondante dans `ISSUES_TRACKER.md` (`- [ ]` → `- [x]`), mettre à jour le compteur de progression et le pointeur « prochaine issue » en bas du fichier, puis cocher la case dans l'EPIC **#35** sur GitHub (`gh issue edit`/`gh api`) et, si pertinent, fermer l'issue (`gh issue close <N>`).
7. **Une seule issue par session.** Ne pas enchaîner sur la suivante automatiquement.
