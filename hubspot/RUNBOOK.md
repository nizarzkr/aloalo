# HubSpot App Card (UI Extension) — Runbook

> Migration de la CRM Card classique (dépréciée, sunset 31 oct. 2026) vers une
> **App Card React**. Côté Next.js, tout est prêt : l'endpoint authentifié
> `/api/hubspot/card-data` renvoie déjà les données (score, nb d'appels, dernier
> appel, axe, id du dernier appel). Il reste à créer le projet HubSpot ci-dessous.
>
> ⚠️ Le format des fichiers de config du CLI HubSpot évolue souvent. **On scaffolde
> d'abord avec `hs project create`** (qui génère une config valide pour ta version),
> **puis Claude adapte** les 2 fichiers de logique. Ne pas écrire la config à la main.

## Décisions (rappel)

- **Private App** (installée sur TON portail de test uniquement). Réutilise le token J15.
- Données récupérées par une **fonction serverless HubSpot** qui appelle notre endpoint
  `/api/hubspot/card-data` avec le secret partagé `HUBSPOT_CARD_SECRET`.
- ⚠️ Non distribuable à des clients tiers → migrer vers **Public App + OAuth au 1er
  client payant** (Claude te le rappellera).

---

## Étape 0 — Côté Vercel (à faire une fois)

Ajouter la variable d'env sur Vercel (Settings → Environment Variables), scopes
**Production + Preview** :

```
HUBSPOT_CARD_SECRET = <la même valeur que dans ton .env.local>
```

(La valeur est déjà dans `.env.local` localement. Pour la relire sans l'afficher en clair
dans le terminal, ouvre `.env.local` dans ton éditeur.)

---

## Étape 1 — Installer le CLI et s'authentifier

```bash
npm install -g @hubspot/cli      # Node ≥ 20 requis (tu es en v25 ✓)
hs --version                     # vérifie l'install
hs account auth                  # ouvre le navigateur → Personal Access Key de ton portail dev
```

## Étape 2 — Scaffolder le projet

Depuis la racine du repo (`~/Desktop/aloalo`) :

```bash
cd hubspot
hs project create                # choisis un template "app card" / "UI extension"
```

Réponds aux prompts (nom de projet, app privée, template app card).
**→ Une fois généré, dis-le à Claude et montre-lui l'arborescence créée**
(`ls -R` dans le dossier du projet) : il adaptera les 2 fichiers ci-dessous à la
structure réelle, sans deviner le format de config.

## Étape 3 — (Claude) adapter la logique

Deux fichiers à remplir avec NOTRE logique (Claude s'en charge après l'étape 2) :

### a) La fonction serverless — appelle notre endpoint

Forme attendue (à reconcilier avec le scaffold) :

```js
// app.functions/getCardData.js
exports.main = async (context) => {
  const base = process.env.ALOALO_BASE_URL || 'https://aloalo-three.vercel.app';
  const portalId = String(context.portalId ?? context.accountId ?? '');
  const contactId = String(context.parameters?.contactId ?? '');

  try {
    const res = await fetch(
      `${base}/api/hubspot/card-data?portalId=${encodeURIComponent(portalId)}&contactId=${encodeURIComponent(contactId)}`,
      { headers: { 'x-aloalo-card-secret': process.env.ALOALO_CARD_SECRET } }
    );
    return await res.json();   // { lastScore, callCount, lastCallLabel, axe, lastCallId } | { message }
  } catch {
    return { message: 'Historique temporairement indisponible' };
  }
};
```

> Le secret `ALOALO_CARD_SECRET` se déclare dans le config du projet (champ `secrets`)
> et se renseigne via `hs secrets add ALOALO_CARD_SECRET` (= valeur de `HUBSPOT_CARD_SECRET`).
> `ALOALO_BASE_URL` peut être un secret ou une constante (URL prod Vercel).

### b) Le composant React — affiche la carte

Forme attendue (à reconcilier avec le scaffold) :

```jsx
import React, { useState, useEffect } from 'react';
import { hubspot, Text, Button, Link, LoadingSpinner, DescriptionList, DescriptionListItem } from '@hubspot/ui-extensions';

hubspot.extend(({ context, runServerlessFunction }) => (
  <AloaloCard context={context} runServerless={runServerlessFunction} />
));

function AloaloCard({ context, runServerless }) {
  const [data, setData] = useState(null);
  const contactId = context.crm?.objectId;

  useEffect(() => {
    runServerless({ name: 'getCardData', parameters: { contactId } })
      .then((r) => setData(r.response))
      .catch(() => setData({ message: 'Historique temporairement indisponible' }));
  }, [contactId]);

  if (!data) return <LoadingSpinner />;
  if (data.message) return <Text>{data.message}</Text>;

  const base = 'https://aloalo-three.vercel.app';
  return (
    <>
      <DescriptionList direction="row">
        <DescriptionListItem label="Dernier score">{data.lastScore != null ? `${data.lastScore}/100` : '—'}</DescriptionListItem>
        <DescriptionListItem label="Appels analysés">{String(data.callCount)}</DescriptionListItem>
        <DescriptionListItem label="Dernier appel">{data.lastCallLabel}</DescriptionListItem>
        <DescriptionListItem label="Axe prioritaire">{data.axe}</DescriptionListItem>
      </DescriptionList>
      <Link href={`${base}/dashboard/calls/${data.lastCallId}`}>Voir le détail sur Aloalo</Link>
    </>
  );
}
```

> ⚠️ Les noms exacts des composants (`DescriptionList`, `Statistics`…) et la signature
> de `runServerlessFunction` dépendent de la version de `@hubspot/ui-extensions` du
> scaffold. Claude alignera sur ce que le template génère.

## Étape 4 — Déployer et tester

```bash
hs secrets add ALOALO_CARD_SECRET   # colle la valeur de HUBSPOT_CARD_SECRET
hs project upload                   # 1er déploiement
hs project dev                      # dev local + preview live ("Developing locally")
```

Puis : installer la Private App sur le portail de test → ouvrir une **fiche contact**
dont le téléphone correspond à un appel analysé dans Aloalo → la carte doit afficher
score / nb d'appels / dernier appel / axe + le bouton vers le détail.

## Vérifs

- `organizations.hubspot_portal_id` en DB = Hub ID du portail de test (sinon "Portail non configuré").
- Endpoint seul : `curl -H "x-aloalo-card-secret: <secret>" ".../api/hubspot/card-data?portalId=<hub>&contactId=<id>"`
  → JSON attendu ; sans le header → 401.
- La route classique `/api/hubspot/crm-card` a été retirée (issue #3) : dépréciée par HubSpot et non authentifiée. Seul `/api/hubspot/card-data` (signature v3, fail closed en prod) sert désormais les données.
