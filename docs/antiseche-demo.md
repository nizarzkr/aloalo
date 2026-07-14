# 🎬 Antisèche démo — Aloalo

**Public :** Mentor / accompagnateur · **Support :** simulé live + appel prêt · **Cible :** ~15 min · 8 écrans

> **LE MANTRA — à répéter à chaque écran :** « Ça se note tout seul, sans une seule minute de saisie. »

---

## ✅ Avant de commencer (pré-vol, la veille)

- [ ] Dashboard **déjà peuplé** : lancer 2-3 appels + la séquence Helios 1/3 → 3/3 la veille.
- [ ] Scénario **Camille Roux (LIVE)** gardé **non lancé** pour l'effet direct.
- [ ] `/dev/test` ouvert dans un onglet caché · dashboard dans l'onglet principal.
- [ ] Internet testé. **Plan B :** si le live rame > 1 min → bascule sur un appel déjà prêt.

---

## 🟢 ACTE 1 — ANALYSER · « l'appel se note tout seul »

### 1. Lancer l'appel LIVE
- **Écran :** `/dev/test` → scénario *Camille Roux (LIVE)* → « Simuler l'appel »
- **Tu dis :** « Il vient de raccrocher. Normalement ça disparaît. Là, regarde. » → l'appel passe *transcribing → analyzed*.
- **→ BÉNÉFICE :** le commercial n'a **RIEN fait** — ni note, ni résumé. La machine s'est lancée toute seule.

### 2. Ouvrir un appel déjà analysé
- **Écran :** `/dashboard/calls/[id]` (un appel prêt)
- **Tu dis / tu déroules :** **synthèse** → **scores par dimension** → **forces/faiblesses avec citations** → **conseils priorisés** → **temps de parole**.
- **→ BÉNÉFICE :** chaque appel = une fiche de coaching **objective**, justifiée par des citations exactes. Incontestable.

### 3. Les tâches de suivi générées
- **Écran :** `/dashboard/todo`
- **Tu dis :** « L'IA a sorti les prochaines actions, avec échéance. Le commercial les retrouve dans son ‘À faire'. »
- **→ BÉNÉFICE :** plus aucune relance oubliée, et toujours **zéro saisie**. C'est l'appel qui crée la to-do.

---

## 🔵 ACTE 2 — PILOTER · « le pipeline respire »

### 4. La vue Deals
- **Écran :** `/dashboard/deals`
- **Tu montres :** le tri par risque, les badges (actif/dormant/gagné/perdu), et un **deal en alerte de décrochage** (séquence Helios).
- **→ BÉNÉFICE :** repérer les deals qui se refroidissent **avant** de les perdre — pas quand le prospect ne répond plus.

### 5. La trajectoire d'un deal
- **Écran :** `/dashboard/deals/[id]`
- **Tu dis :** « L'histoire du deal appel après appel, avec la courbe d'engagement. »
- **→ BÉNÉFICE :** comprendre l'état d'un deal en 30 s au lieu d'interroger le commercial.

### 6. La « définition de la qualité »
- **Écran :** `/dashboard/settings/exit-criteria`
- **Tu dis :** « Ce qui doit être vrai pour qu'un deal change de phase. L'IA propose, l'owner valide. »
- **→ BÉNÉFICE :** fini les deals bloqués « parce que ». Le pipeline devient **honnête**.

---

## 🟩 ACTE 3 — COACHER · « mieux, en moins de temps »

### 7. Préparer un 1:1
- **Écran :** `/dashboard/one-on-ones` → choisir un commercial
- **Tu dis :** « Avant l'entretien : progrès, points récurrents, sur quoi insister — généré. »
- **→ BÉNÉFICE :** un 1:1 préparé en 2 min au lieu de 30, basé sur des **faits** et pas sur une impression.

### 8. Les intégrations (bref)
- **Écran :** `/dashboard/settings/integrations`
- **Tu dis :** « Ringover, Aircall, Google Meet, HubSpot, Pipedrive. On s'insère dans leurs outils actuels. »
- **→ BÉNÉFICE :** rien à changer dans leurs habitudes. *(Signal mentor : architecture pensée pour scaler.)*

---

## 🎤 Clôture (30 secondes)

> « L'appel se note seul, le commercial sait quoi faire, le manager voit les deals qui décrochent et coache sur des faits. Le tout **sans une minute de saisie**. »

**Puis, pour le mentor :** ouvre sur le prochain jalon — branchement API Ringover réel (aujourd'hui via simulateur) + 1ʳᵉ PME pilote. Montre que tu sais **où tu vas**.

---

## ⚠️ Les 3 pièges à éviter

1. **Ne pas attendre le live en silence.** Ça transcrit → tu parles ou tu montres autre chose.
2. **Ne pas tout montrer.** 8 écrans, pas 15. Trop de features noie le message.
3. **Toujours revenir au bénéfice.** Après chaque écran : « et donc, concrètement… ».
