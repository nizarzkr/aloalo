# Aloalo — Brief GTM (contexte produit pour stratégie go-to-market)

> Document autoportant, à fournir comme contexte à une IA pour construire la stratégie GTM
> et identifier les premiers clients / design partners. Rédigé le 9 juin 2026.
> Ton volontairement mesuré : orienté problème → bénéfice → feature, sans survente.

---

## 1. En une phrase

Aloalo est un outil de **conversation intelligence** pour les PME et startups françaises (5 à 50 commerciaux).
Il se branche sur la téléphonie (Ringover, Aircall) et les outils de réunion (Google Meet), transcrit et
analyse les conversations commerciales via IA, et en restitue trois usages : un **assistant** pour le
commercial, un **appui au coaching** pour le manager, et des **signaux objectifs** pour le pilotage du pipe.

## 2. Le problème

Dans une équipe commerciale, l'essentiel de l'information sur les clients se joue à l'oral, en appel ou en
visio. Cette matière est rarement réexploitée après coup, pour des raisons simples : la retranscrire et
l'analyser à la main coûte du temps que personne n'a.

Concrètement, selon le rôle :
- **Le commercial** consacre du temps à la prise de notes et à la mise à jour du CRM après l'appel, au
  détriment du temps de vente. Des next steps se perdent quand l'agenda se charge.
- **Le manager** dispose de peu de matière factuelle pour préparer ses 1:1 et son coaching : il s'appuie
  surtout sur les chiffres de résultat (rendez-vous pris, deals signés) et sur ce que le commercial lui
  rapporte, rarement sur ce qui s'est réellement dit en appel.
- **Le responsable commercial / Rev Ops** pilote avec une qualification du pipe en partie déclarative
  ("ce deal avance bien"), difficile à objectiver tant qu'on n'écoute pas les appels un par un.

Ces équipes de 5 à 50 commerciaux n'ont généralement **pas de Rev Ops dédié ni de temps de coaching
structuré** : ce sont des fonctions qu'elles aimeraient avoir mais qu'elles ne peuvent pas internaliser à
ce stade.

## 3. La proposition de valeur

Rendre exploitable, automatiquement, ce qui se dit dans les conversations commerciales — pour gagner du
temps côté commercial, donner de la matière concrète au coaching, et objectiver le pilotage du pipe.

Formulé côté client : **un appui Rev Ops et coaching que la PME peut s'offrir avant d'avoir les moyens
d'embaucher ces profils à temps plein.**

## 4. Ce que fait le produit, par persona

### Le commercial — gagner du temps et ne rien laisser tomber
- **Problème** : prise de notes et CRM chronophages, next steps oubliés.
- **Ce qu'Aloalo fait** : note de synthèse générée après l'appel ; tâches de suivi proposées avec une
  échéance contextualisée (pas un rappel générique) ; points de suivi prêts à reprendre dans l'email que
  le commercial enverra lui-même ; suggestion de prochaine étape.
- **Bénéfice** : moins de temps administratif post-appel, et un suivi plus régulier des opportunités.
- **Intégration** : notes et tâches poussées dans HubSpot, sur le bon contact / deal.

### Le manager — coacher sur des faits, pas sur le ressenti
- **Problème** : peu de matière concrète pour préparer un 1:1 utile.
- **Ce qu'Aloalo fait** : analyse de l'appel par **dimensions** (ex. découverte, objections, prochaine
  étape), chaque dimension étant marquée validé / partiel / manqué **et justifiée par une citation de
  l'appel** ; métriques de dynamique calculées sans IA (temps de parole, alternance des tours de parole,
  plus long monologue, rapidité à passer au pitch) ; signaux comportementaux (questions ouvertes/fermées,
  réaction au prix, gestion du silence après une objection) ; une **alerte** lorsqu'un deal montre des
  signes de décrochage, accompagnée d'une piste d'action pour le 1:1.
- **Bénéfice** : des 1:1 préparés en quelques minutes, ancrés sur des moments précis d'appels réels.

### Le responsable commercial / Rev Ops — objectiver le pilotage
- **Problème** : qualification du pipe en partie subjective, difficile à vérifier à grande échelle.
- **Ce qu'Aloalo fait** : repère côté prospect des **signaux** issus de la conversation (intentions
  d'achat exprimées, fermeté du prochain rendez-vous, nature des objections) pour appuyer la
  qualification ; suit le **momentum d'un deal** sur plusieurs appels (progression ou décrochage) avec les
  raisons explicitées ; vue agrégée par deal (statut actif/dormant, tendance, alerte si décrochage).
- **Bénéfice** : une lecture du pipe plus factuelle, sans avoir à réécouter les appels un par un.

## 5. Partis pris produit (utiles à connaître pour le GTM)

- **Sobriété assumée** : on privilégie une alerte ou un constat actionnable à une avalanche de KPIs. Le
  score global sur 100 a été volontairement retiré au profit d'évaluations par dimensions, plus lisibles.
- **Analyses sourcées** : chaque évaluation IA s'appuie sur une citation de l'appel, pour rester
  vérifiable et inspirer confiance.
- **Périmètre resserré** : pas de forecasting prédictif, pas de catalogue d'intégrations tous azimuts. On
  couvre bien un périmètre précis plutôt que large.

## 6. Cible

- **Startups et PME françaises de 5 à 50 commerciaux** (cœur de cible 5–30).
- Utilisant **Ringover ou Aircall** (téléphonie française) et/ou Google Meet.
- **Sans Rev Ops dédié** ni dispositif de coaching structuré.
- Interlocuteurs : **directeur commercial / Head of Sales** (pilotage), **manager d'équipe** (coaching),
  **Rev Ops** quand le poste existe. Dans ces tailles, ces rôles sont souvent portés par une même personne,
  voire par le fondateur.

## 7. Concurrents et positionnement

**Sur le fond** : Attention.com (US, Série A 14 M$ oct. 2024 ; clients dont BambooHR, Aircall, Clay),
Claap, et plus haut de gamme Gong et Modjo.

**Lecture** : leur existence et leur financement **confirment qu'il y a un marché**. Ils s'adressent
toutefois plutôt à des organisations dotées d'équipes Rev Ops établies, avec une tarification et une
richesse fonctionnelle pensées pour ce segment (Attention : 59 / 149 / 399 $ par utilisateur/mois).

**Différenciation visée par Aloalo :**
1. **Hébergement et traitement des données en Europe (RGPD)** — Supabase Paris, AssemblyAI EU, sans
   transit hors UE. Argument de réassurance fort pour les décideurs français sensibles à la conformité.
2. **Téléphonie française au cœur du produit** (Ringover, Aircall), avec un branchement rapide pour une
   équipe qui les utilise déjà.
3. **Périmètre resserré et lisible**, adapté à une équipe sans Rev Ops, plutôt qu'une suite complète.
4. **Tarif positionné pour la PME.**
5. **Expérience française native** : interface, support, facturation en euros.

**Ambition de départ réaliste** : sécuriser **20 à 30 PME françaises payantes** — un segment que les
acteurs US financés ont peu d'intérêt à adresser.

## 8. État du produit (juin 2026)

- **MVP fonctionnel de bout en bout** : transcription → analyse IA (dimensions + signaux) → assistant
  (note, tâches, next steps) → intégration HubSpot (cartes contact et deal, push automatique post-appel)
  → pages de pilotage (Deals, momentum, alerte coaching).
- **Stack** : Next.js 16, Supabase (Paris), AssemblyAI (EU), Claude Haiku, hébergé sur Vercel ;
  paiement Stripe en mode test.
- **Encore à faire** : premier client payant ; validation de l'intégration Ringover sur les données réelles
  d'un client (le pipeline est aujourd'hui testé via des simulations) ; finalisation facturation et cadre
  juridique.
- **Équipe** : Nizar, fondateur solo, non technique, construit le produit en pilotant une IA de développement.

## 9. Objectif GTM

Définir comment trouver et convaincre les **premières PME françaises** correspondant à la cible
(5–50 commerciaux, sous Ringover/Aircall, sans Rev Ops), et idéalement recruter quelques **design
partners** pour valider le produit sur de vraies conversations clients avant de passer à l'échelle.
