# Script de démo Aloalo — 7 minutes (prospect / futur client)

> **Audience** : responsable commercial / dirigeant de PME (5–50 commerciaux) sous Ringover ou Aircall.
> **Objectif** : montrer en 7 min que l'IA écoute *tous* les appels, score la performance, génère du coaching, et pousse le suivi directement dans HubSpot — sans rien changer aux habitudes de l'équipe.
> **Fil rouge** : « Votre IA écoute tous vos appels. Vous ne recevez que l'essentiel. »

---

## ✅ Checklist pré-démo (5 min avant)

- [ ] Connecté en `nizarmgmt` (org **Ableton** = celle qui a HubSpot branché).
- [ ] **Profil IA rempli** (`/dashboard/settings/ai-profile`) — sinon le badge « Analyse personnalisée » ne sortira pas.
- [ ] HubSpot **connecté** (`/dashboard/settings/integrations` → badge « Configuré »).
- [ ] Contact HubSpot **Camille Flowly** (`+33178223344`) existe **et a un deal associé** (sinon pas de rattachement deal à montrer).
- [ ] Onglets ouverts d'avance : `Aloalo /dashboard/calls` + la fiche **deal** HubSpot de Camille Flowly.
- [ ] ⚠️ **Ne jamais utiliser le numéro `+33189665544`** (donnée de test corrompue). Utiliser le mock « démo planifiée » = `+33178223344`.
- [ ] Plan B si la simu rame : avoir **un appel déjà analysé** ouvert dans un onglet de secours.

---

## ⏱️ Déroulé minute par minute

### 0:00 — 0:45 · Le problème (landing `/`)
**Écran** : la landing page.
**Tu dis** :
> « Vos commerciaux passent 30, 50, 100 appels par semaine. Un manager ne peut en écouter que 2 ou 3. Résultat : le coaching se fait au feeling, et 95% des appels ne sont jamais analysés. Aloalo écoute **tout**, et ne vous remonte que l'essentiel. »

**Point de valeur** : on ne vend pas de la transcription, on vend du **coaching qui scale**.

---

### 0:45 — 1:30 · Onboarding & Profil IA
**Écran** : `/dashboard/settings/ai-profile`.
**Tu montres** : le Profil IA (secteur, cible, méthodo de vente, objections types).
**Tu dis** :
> « On configure une fois le contexte de **votre** équipe : ce que vous vendez, à qui, votre méthode. L'IA analyse alors chaque appel **avec vos critères**, pas un barème générique. »

**Point de valeur** : analyse **personnalisée**, pas une boîte noire.

---

### 1:30 — 2:00 · Connexion HubSpot
**Écran** : `/dashboard/settings/integrations`.
**Tu montres** : le badge HubSpot « Configuré » (ne pas re-coller le token en live).
**Tu dis** :
> « Aloalo se branche sur votre CRM. Pas un CRM de plus : on enrichit **le vôtre**. »

**Point de valeur** : zéro friction, ça s'intègre à l'existant.

---

### 2:00 — 3:00 · Le « wow » : un appel analysé en quelques secondes
**Écran** : `/dashboard/calls` → bouton **« Simuler un appel »**.
**Tu dis** (pendant le traitement) :
> « En prod, ça se déclenche tout seul à chaque appel Ringover. Là je simule. Transcription, diarisation commercial/prospect, puis analyse IA Claude… »

Attendre le statut **« Analysé »**, puis ouvrir l'appel.

**Point de valeur** : automatique, rapide, zéro action du commercial.

---

### 3:00 — 5:00 · Le cœur : la page d'analyse
**Écran** : la page détail de l'appel (4 sections rétractables).
**Tu déroules dans l'ordre :**

1. **En-tête** — « Regardez : ce n'est pas un numéro, c'est **Camille Flowly · Flowly SAS · [nom du deal]**. Aloalo a retrouvé le contact, l'entreprise et l'affaire dans HubSpot. »
2. **Scoring** — score global /100 + les 5 axes (Découverte, Qualification, Closing, Objections, Next step). « En un coup d'œil, où ça pèche. »
3. **Analyse** — résumé, points forts, axes d'amélioration **avec citations de l'appel**, puis le **coaching priorisé**. Pointer le badge **« Analyse personnalisée »** : « ça a tourné avec **votre** profil. »
4. **Prochaines étapes** — les points à mettre dans l'email de suivi (bouton **Copier**) + les **tâches de relance datées intelligemment** (« relancer le lendemain de sa réunion manager », pas un J+2 générique).

**Point de valeur** : un manager comprend la perf d'un appel en **15 secondes**, et le commercial a son plan d'action prêt.

---

### 5:00 — 6:00 · La boucle HubSpot (le vrai différenciant)
**Écran** : bascule sur la **fiche deal HubSpot** de Camille Flowly.
**Tu montres** : la **note de synthèse** + les **tâches de suivi** créées automatiquement **sur le deal**, et la **carte Aloalo** (digest des appels du deal).
**Tu dis** :
> « Tout ce que vous venez de voir est **déjà dans HubSpot**, sur l'affaire. Le commercial ne ressaisit rien : il ouvre son deal, ses tâches de relance datées l'attendent. »

**Point de valeur** : le suivi **vit là où l'équipe travaille déjà**. C'est ça qui fait que c'est adopté.

---

### 6:00 — 7:00 · Vue manager + close
**Écran** : `/dashboard` (vue d'ensemble) ou `/dashboard/team` (scores par commercial).
**Tu dis** :
> « Côté manager : la perf par commercial, les tendances, qui progresse. »

**Close (les 3 réassurances) :**
- 🇫🇷 **RGPD by design** : données en Europe (Supabase Paris, transcription EU), audio supprimé après transcription.
- 🔌 **Branchement en 5 min** : Ringover/Aircall via webhook, zéro changement pour les commerciaux.
- 💶 **Tarifs simples** : Starter 49€ / Growth 99€ / Scale 199€ par mois. 14 jours d'essai, sans CB.

> « On démarre votre essai cette semaine ? »

---

## 🧯 Pièges & plan B
- **La simu échoue / rame** → ouvrir l'appel déjà analysé de secours, dérouler le même discours (3:00–5:00).
- **« Aucun contact HubSpot trouvé »** → c'est normal si le numéro mock n'est pas dans le CRM ; basculer sur l'appel de Camille Flowly (numéro `+33178223344`) qui, lui, est rattaché.
- **Ne jamais** lancer le transcript du numéro `+33189665544` (donnée corrompue).
- Garder le **mode clair** (la DA est clair-only) ; pas de bascule sombre.

## 🎯 Les 3 phrases à ne pas rater
1. « On n'analyse pas 3 appels par semaine. On les analyse **tous**. »
2. « L'IA score avec **vos** critères, pas un barème générique. »
3. « Le suivi atterrit **dans votre HubSpot**, sur l'affaire — le commercial ne ressaisit rien. »
