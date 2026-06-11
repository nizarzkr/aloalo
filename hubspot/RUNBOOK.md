# HubSpot App Card (UI Extension) — Runbook

> Migration de la CRM Card classique (dépréciée, sunset 31 oct. 2026) vers une
> **App Card React**. Côté Next.js, tout est prêt : l'endpoint authentifié
> `/api/hubspot/card-data` renvoie déjà les données (score, nb d'appels, dernier
> appel, axe, id du dernier appel). Il reste à créer/déployer le projet HubSpot ci-dessous.
>
> ⚠️ Le format des fichiers de config du CLI HubSpot évolue souvent. **On scaffolde
> d'abord avec `hs project create`** (qui génère une config valide pour ta version),
> **puis Claude adapte** le composant React. Ne pas écrire la config à la main.

## Architecture (important)

La carte appelle notre endpoint `/api/hubspot/card-data` **directement** depuis le
composant React, via `hubspot.fetch()` — **pas de fonction serverless HubSpot relais**
(elle exigeait un abonnement Enterprise). Le composant réel vit déjà dans le repo :

```
hubspot/aloalo-crm-card/src/app/cards/AloaloCard.tsx
```

### Authentification : signature v3 (et non un secret partagé custom)

`hubspot.fetch()` **n'envoie pas d'en-têtes custom**. L'authentification repose sur la
**signature HubSpot v3** que HubSpot ajoute automatiquement à chaque requête sortante :

- En-têtes : `X-HubSpot-Signature-v3` + `X-HubSpot-Request-Timestamp`.
- Vérification côté serveur (`app/api/hubspot/card-data/route.ts`) : HMAC-SHA256 sur
  `method + url + body + timestamp`, avec le secret **`HUBSPOT_APP_CLIENT_SECRET`**
  (client secret de l'app HubSpot, récupérable dans les réglages d'auth de l'app —
  cf. `AGENTS.md`). Comparaison en temps constant.
- Comportement : signature manquante/invalide → **401**. Si `HUBSPOT_APP_CLIENT_SECRET`
  est **absente en production → 401 (fail closed)** : aucune donnée tenant servie. La
  tolérance sans secret existe **uniquement hors production** (dev local), pour itérer.

> L'ancien secret partagé custom et son en-tête HTTP (architecture serverless
> abandonnée) ne sont **plus utilisés** — ne plus jamais les configurer.

## Décisions (rappel)

- **Private App** (installée sur TON portail de test uniquement). Réutilise le token J15.
- ⚠️ Non distribuable à des clients tiers → migrer vers **Public App + OAuth au 1er
  client payant** (Claude te le rappellera).

---

## Étape 0 — Côté Vercel (à faire une fois)

Ajouter la variable d'env sur Vercel (Settings → Environment Variables), scopes
**Production + Preview** :

```
HUBSPOT_APP_CLIENT_SECRET = <client secret de l'app HubSpot>
```

> La valeur **ne** provient **pas** d'un copier-coller de `.env.local` : c'est le
> *client secret* de l'app HubSpot, récupérable dans les réglages d'auth de l'app
> (cf. `AGENTS.md`). Tant que cette variable n'est pas posée en production, l'endpoint
> répond 401 (fail closed) et la carte n'affiche aucune donnée.

---

## Étape 1 — Installer le CLI et s'authentifier

```bash
npm install -g @hubspot/cli      # Node ≥ 20 requis
hs --version                     # vérifie l'install
hs account auth                  # ouvre le navigateur → Personal Access Key de ton portail dev
```

## Étape 2 — Scaffolder / vérifier le projet

Le projet vit déjà dans `hubspot/aloalo-crm-card/`. Si tu repars de zéro :

```bash
cd hubspot
hs project create                # choisis un template "app card" / "UI extension"
```

Réponds aux prompts (nom de projet, app privée, template app card).
**→ Une fois généré, dis-le à Claude et montre-lui l'arborescence créée**
(`ls -R` dans le dossier du projet) : il alignera le composant React sur la structure
réelle, sans deviner le format de config.

## Étape 3 — (Claude) adapter le composant React

Le composant `hubspot/aloalo-crm-card/src/app/cards/AloaloCard.tsx` appelle directement
notre endpoint via `hubspot.fetch()` (pas de `runServerlessFunction`) et affiche
score / nb d'appels / dernier appel / axe + un lien vers le détail sur Aloalo.

> ⚠️ Les noms exacts des composants (`DescriptionList`, `Statistics`…) et la signature
> de `hubspot.fetch()` dépendent de la version de `@hubspot/ui-extensions` du scaffold.
> Claude alignera sur ce que le template génère — se référer au fichier réel ci-dessus,
> pas à un snippet figé dans ce runbook.

## Étape 4 — Déployer et tester

```bash
hs project upload                # 1er déploiement
hs project dev                   # dev local + preview live ("Developing locally")
```

Puis : installer la Private App sur le portail de test → ouvrir une **fiche contact/deal**
dont le téléphone correspond à un appel analysé dans Aloalo → la carte doit afficher
score / nb d'appels / dernier appel / axe + le bouton vers le détail.

## Vérifs

- `organizations.hubspot_portal_id` en DB = Hub ID du portail de test (sinon "Portail non configuré").
- `HUBSPOT_APP_CLIENT_SECRET` posée sur Vercel (Production + Preview).
- **Validation de bout en bout depuis HubSpot** (et non par curl) : un `curl` brut ne
  peut pas reproduire une signature `X-HubSpot-Signature-v3` valide → ouvrir la carte sur
  une fiche contact/deal dans HubSpot pour tester. Rappel comportement : secret posé →
  requête sans/avec mauvaise signature = 401 ; secret absent en prod = 401 (fail closed) ;
  secret absent hors prod = vérification désactivée (dev uniquement).
- La route classique `/api/hubspot/crm-card` est dépréciée (sunset 31 oct. 2026) : à
  retirer une fois la nouvelle carte validée. Seul `/api/hubspot/card-data`
  (signature v3, fail closed en prod) sert désormais les données.
