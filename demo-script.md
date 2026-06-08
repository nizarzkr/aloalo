# Script de démo Aloalo — 8 minutes (prospect / futur client)

> **Audience** : responsable commercial / dirigeant de PME (5–50 commerciaux) sous Ringover ou Aircall.
> **Objectif** : montrer qu'Aloalo est **le Revenue Ops que la PME ne peut pas (encore) recruter** —
> il écoute tous les appels, évalue sur des faits, repère le deal qui va se perdre, et pousse le
> suivi dans HubSpot, sans rien changer aux habitudes de l'équipe.
> **Fil rouge / accroche** : *« Les grosses boîtes ont un Revenue Ops et un coach commercial à temps plein.
> Vous, non — et vous ne pouvez pas vous le payer. Aloalo, c'est cette compétence-là, en logiciel. »*

---

## ✅ Checklist pré-démo (5 min avant)

- [ ] Connecté en `nizarmgmt` (org **Ableton** = celle qui a HubSpot branché).
- [ ] **Profil IA rempli** (`/dashboard/settings/ai-profile`) — sinon le badge « Analyse personnalisée » ne sortira pas.
- [ ] HubSpot **connecté** (`/dashboard/settings/integrations` → badge « Configuré »).
- [ ] **Données « deal qui se perd » prêtes** : les 3 appels **Helios** (`mock-12/13/14`, même numéro `+33170000123`) déjà simulés et analysés → la page `/dashboard/deals` doit montrer Helios **en décrochage avec l'alerte coaching**. (Helios est simulé, **pas** dans HubSpot — c'est normal, voir plan B.)
- [ ] **Données HubSpot réelles prêtes** : contacts **Acme Corp** (Camille Roux `+33180000201` + Thomas Vidal `+33180000202`, **même deal**) présents dans HubSpot Ableton avec deal associé.
- [ ] **Appel live identifié** : `mock-18` · « Acme Corp — Camille Roux (à simuler en LIVE) » — c'est celui qu'on simule en direct à l'étape 2:00. (Même deal Acme → il s'ajoute à la trajectoire.) Ne PAS le pré-simuler avant la démo, l'intérêt c'est de le lancer en live.
- [ ] Onglets ouverts d'avance : `Aloalo /dashboard/deals` + la fiche **deal Acme** HubSpot.
- [ ] ⚠️ **Ne jamais utiliser le numéro `+33189665544`** (donnée de test corrompue).
- [ ] Plan B si la simu rame : avoir **un appel déjà analysé** ouvert dans un onglet de secours.

---

## ⏱️ Déroulé minute par minute

### 0:00 — 0:50 · Le problème (landing `/`)
**Écran** : la landing page.
**Tu dis** :
> « Les boîtes du CAC 40 ont un *Revenue Ops* qui analyse chaque deal et un coach commercial qui débriefe chaque appel. Vous, avec 8 commerciaux, vous ne pouvez ni recruter l'un ni l'autre — ça coûte deux salaires à temps plein. Du coup vos commerciaux passent 50, 100 appels par semaine, un manager en écoute 2 ou 3, et le coaching se fait au feeling. Aloalo, c'est ce Revenue Ops et ce coach — en logiciel. Il écoute **tout**, et ne vous remonte que l'essentiel. »

**Point de valeur** : on ne vend pas de la transcription, on vend **une compétence d'équipe que vous ne pouvez pas embaucher**.

---

### 0:50 — 1:30 · On lui apprend votre métier (Profil IA)
**Écran** : `/dashboard/settings/ai-profile`.
**Tu montres** : le Profil IA (secteur, cible, méthodo de vente, objections types).
**Tu dis** :
> « Comme un nouveau Revenue Ops à qui on explique le métier : une fois, on lui donne le contexte de **votre** équipe — ce que vous vendez, à qui, votre méthode. À partir de là il évalue chaque appel **avec vos critères**, pas un barème générique. »

**Point de valeur** : analyse **personnalisée**, pas une boîte noire.

---

### 1:30 — 2:00 · Il se branche sur votre CRM (HubSpot)
**Écran** : `/dashboard/settings/integrations`.
**Tu montres** : le badge HubSpot « Configuré » (ne pas re-coller le token en live).
**Tu dis** :
> « Pas un CRM de plus à maintenir. On enrichit **le vôtre**. »

**Point de valeur** : zéro friction, ça s'intègre à l'existant.

---

### 2:00 — 3:00 · Le « wow » : un appel évalué en quelques secondes
**Écran** : `/dashboard/calls` → bouton **« Simuler un appel »** → choisir **`mock-18` · « Acme Corp — Camille Roux (à simuler en LIVE) »** (objection concurrent US bien traitée → l'analyse aura de la matière à montrer).
**Tu dis** (pendant le traitement) :
> « En prod, ça se déclenche tout seul à chaque appel Ringover. Là je simule. Transcription, séparation commercial/prospect, puis analyse… »

Attendre le statut **« Analysé »**, puis ouvrir l'appel.

**Point de valeur** : automatique, rapide, zéro action du commercial.

---

### 3:00 — 4:30 · Le cœur : la page d'analyse
**Écran** : la page détail de l'appel (synthèse persistante + onglets).
**Tu déroules dans l'ordre :**

1. **En-tête** — « Regardez : ce n'est pas un numéro, c'est **Camille Roux · Acme Corp · Acme Corp — Déploiement Q3**. Aloalo a retrouvé le contact, l'entreprise et l'affaire dans HubSpot tout seul. »
2. **Évaluation** — les **dimensions factuelles** (Découverte, Qualification, Objections, Closing, Next step), chacune **validée / partielle / manquée**, avec une **citation de l'appel** en preuve. « On ne vous sort pas une note opaque sur 100 — on vous montre *ce qui s'est dit*, et ce qui a manqué, preuve à l'appui. » Pointer le badge **« Analyse personnalisée »**.
3. **Dynamique** — temps de parole, relances, signaux d'achat du prospect, fermeté du next step. « La lecture qu'un bon coach ferait à l'oreille — automatisée. »
4. **Coaching** — le conseil **priorisé** (le seul qui compte), pas une liste de 40 reproches.
5. **Suivi** — les points à mettre dans l'email (bouton **Copier**) + les **tâches de relance datées intelligemment** (« relancer le lendemain de sa réunion DAF », pas un J+2 générique).

**Point de valeur** : un manager comprend la perf d'un appel en **15 secondes**, et le commercial a son plan d'action prêt.

---

### 4:30 — 6:00 · La pièce maîtresse : « voici le deal que votre commercial va perdre »
**Écran** : `/dashboard/deals` → ouvrir le deal **Helios** (3 appels, en décrochage).
**Tu dis** :
> « Voilà ce qu'un Revenue Ops ferait pour vous, et que personne n'a le temps de faire : suivre la **trajectoire** d'un deal sur plusieurs appels. Helios — trois échanges. Regardez la courbe : ça **refroidit**. Premier appel chaleureux, deuxième tiède, troisième le prospect ghoste. »

Pointer **l'alerte coaching** sur le deal :
> « Aloalo ne se contente pas de le constater. Il dit **pourquoi** ça décroche et **quelle action 1:1** le manager doit mener cette semaine pour le sauver. Ça, aujourd'hui, vous ne l'avez nulle part : le deal se perd en silence, et vous le découvrez au forecast du mois suivant. »

**Point de valeur** : c'est **le** différenciant. On ne note pas des appels isolés — on **pilote des affaires** et on déclenche l'intervention au bon moment. C'est littéralement le boulot d'un Revenue Ops.

---

### 6:00 — 7:00 · La boucle HubSpot (le suivi vit là où l'équipe travaille)
**Écran** : bascule sur la **fiche deal Acme** dans HubSpot.
**Tu montres** : la **note de synthèse** + les **tâches de suivi** créées automatiquement **sur le deal**, et la **carte Aloalo** (digest des appels du deal). Mentionner que **Camille Roux ET Thomas Vidal (le DAF)** sont sur le même deal → Aloalo voit le **multi-threading**.
**Tu dis** :
> « Tout ce que vous venez de voir est **déjà dans HubSpot**, sur l'affaire. Le commercial ne ressaisit rien : il ouvre son deal, ses tâches de relance datées l'attendent. Et comme Aloalo relie les deux interlocuteurs au même deal, vous voyez aussi si une affaire ne tient qu'à une seule personne. »

**Point de valeur** : le suivi **vit là où l'équipe travaille déjà**. C'est ça qui fait que c'est adopté.

---

### 7:00 — 8:00 · Close
**Tu dis** :
> « Donc : un Revenue Ops et un coach, qui écoutent 100 % des appels, pilotent vos deals, et remplissent votre CRM — pour le prix d'un logiciel, pas de deux salaires. »

**Close (les 3 réassurances) :**
- 🇫🇷 **RGPD by design** : données en Europe (Supabase Paris, transcription EU), audio supprimé après transcription. *(À la différence des plateformes américaines.)*
- 🔌 **Branchement en 5 min** : Ringover/Aircall via webhook, zéro changement pour les commerciaux.
- 💶 **Tarifs simples** : Starter 49€ / Growth 99€ / Scale 199€ par mois. 14 jours d'essai, sans CB.

> « On démarre votre essai cette semaine ? »

---

## 🧯 Pièges & plan B
- **La simu échoue / rame** → ouvrir l'appel déjà analysé de secours, dérouler le même discours (3:00–4:30).
- **« Helios n'apparaît pas en décrochage »** → vérifier que les 3 appels `mock-12/13/14` sont bien analysés (même numéro) ; sans les 3, pas de trajectoire ni d'alerte.
- **« Aucun contact HubSpot sur Helios »** → **normal**, Helios est simulé. La boucle HubSpot se montre sur **Acme** (vraies données). Ne pas chercher Helios dans HubSpot en live.
- **Ne jamais** lancer le transcript du numéro `+33189665544` (donnée corrompue).
- Garder le **mode clair** (la DA est clair-only) ; pas de bascule sombre.

## 🎯 Les 3 phrases à ne pas rater
1. « Aloalo, c'est le **Revenue Ops que vous ne pouvez pas vous payer** — en logiciel. »
2. « On ne vous note pas sur 100 : on vous montre **ce qui s'est dit**, preuve à l'appui. »
3. « Voici le deal que votre commercial **va perdre** — et l'action pour le sauver. »
