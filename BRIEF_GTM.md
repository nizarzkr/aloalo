# Aloalo — Brief GTM (contexte produit pour stratégie go-to-market)

> Document autoportant, à fournir comme contexte à une IA pour construire la stratégie GTM
> et identifier les premiers clients / design partners. Rédigé le 9 juin 2026, mis à jour le 20 juillet 2026.
> Ton volontairement mesuré : orienté problème → bénéfice → feature, sans survente.

---

## 1. En une phrase

Aloalo est un outil de **conversation intelligence** pour les PME et startups françaises (5 à 50 commerciaux).
Il se branche sur la téléphonie (Ringover, Aircall) et les outils de réunion (Google Meet), transcrit et
analyse les conversations commerciales via IA, puis renvoie tout dans le CRM déjà en place (HubSpot ou
Pipedrive). Il en restitue trois usages, organisés en trois « actes » : **Analyser** (un assistant qui note
l'appel à la place du commercial), **Piloter** (des signaux objectifs sur la santé du pipe) et **Coacher**
(un appui factuel au manager).

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
  échéance contextualisée (pas un rappel générique), regroupées dans une file **« À faire »** cochable ;
  points de suivi prêts à reprendre dans l'email que le commercial enverra lui-même ; suggestion de
  prochaine étape.
- **Bénéfice** : moins de temps administratif post-appel, aucune relance oubliée, et un suivi plus régulier
  des opportunités — le tout sans une minute de saisie (c'est l'appel qui crée la note et la to-do).
- **Intégration** : notes et tâches poussées automatiquement dans le CRM de l'équipe — **HubSpot ou
  Pipedrive** — sur le bon contact / deal.

### Le manager — coacher sur des faits, pas sur le ressenti
- **Problème** : peu de matière concrète pour préparer un 1:1 utile.
- **Ce qu'Aloalo fait** : analyse de l'appel par **dimensions** (ex. découverte, objections, prochaine
  étape), chaque dimension étant marquée validé / partiel / manqué **et justifiée par une citation de
  l'appel** ; métriques de dynamique calculées sans IA (temps de parole, alternance des tours de parole,
  plus long monologue, rapidité à passer au pitch) ; signaux comportementaux (questions ouvertes/fermées,
  réaction au prix, gestion du silence après une objection). Deux briques dédiées au manager : un
  **briefing « Préparer un 1:1 »** généré avant l'entretien (progrès, points récurrents, sur quoi insister,
  au ton bienveillant) et un **profil de coaching** par commercial qui agrège ses tendances dans le temps.
  Une **alerte** signale enfin les deals qui décrochent, avec une piste d'action prête à pousser en tâche.
- **Bénéfice** : des 1:1 préparés en 2 minutes au lieu de 30, ancrés sur des moments précis d'appels réels
  plutôt que sur une impression.

### Le responsable commercial / Rev Ops — objectiver le pilotage
- **Problème** : qualification du pipe en partie subjective, difficile à vérifier à grande échelle.
- **Ce qu'Aloalo fait** : repère côté prospect des **signaux** issus de la conversation (intentions
  d'achat exprimées, fermeté du prochain rendez-vous, nature des objections) pour appuyer la
  qualification ; suit le **momentum d'un deal** sur plusieurs appels (progression ou décrochage) avec les
  raisons explicitées ; vue **Deals** agrégée (statut actif/dormant/gagné/perdu, tendance, tri par risque).
  Trois briques de pilotage complètent l'ensemble : une **hygiène de pipeline** qui détecte les écarts
  (deal bloqué sans raison, phase incohérente, next step manquant) et propose une correction en un clic ;
  une **définition de la qualité par phase** (« exit-criteria » : ce qui doit être vrai pour changer de
  phase — l'IA propose, l'owner valide) ; et une **couche de fiabilité du forecast** qui signale les deals
  dont l'avancement déclaré n'est pas soutenu par ce qui s'est dit en appel.
- **Bénéfice** : une lecture du pipe plus factuelle et un forecast plus honnête, sans avoir à réécouter les
  appels un par un.

## 5. Partis pris produit (utiles à connaître pour le GTM)

- **Sobriété assumée** : on privilégie une alerte ou un constat actionnable à une avalanche de KPIs. Le
  score global sur 100 a été volontairement retiré au profit d'évaluations par dimensions, plus lisibles.
- **Analyses sourcées** : chaque évaluation IA s'appuie sur une citation de l'appel, pour rester
  vérifiable et inspirer confiance.
- **L'IA propose, l'humain valide** : sur les briques structurantes (exit-criteria, corrections de
  pipeline), Aloalo suggère mais n'impose rien — l'owner garde la main.
- **On fiabilise, on ne devine pas** : pas de forecast prédictif inventé de toutes pièces ; Aloalo se
  contente de dire si le forecast déjà présent dans le CRM est soutenu par les appels réels.
- **Périmètre resserré** : on couvre bien un périmètre précis (téléphonie/visio FR + 2 CRM courants)
  plutôt qu'un catalogue d'intégrations tous azimuts.

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
2. **Téléphonie et visio françaises au cœur du produit** (Ringover, Aircall, Google Meet), avec un
   branchement rapide pour une équipe qui les utilise déjà.
3. **On s'insère dans les outils existants sans lock-in** : le CRM reste HubSpot ou Pipedrive (grâce à une
   abstraction CRM interne qui rend l'ajout d'un 2ᵉ, 3ᵉ connecteur peu coûteux). Rien à changer dans les
   habitudes de l'équipe.
4. **Périmètre resserré et lisible**, adapté à une équipe sans Rev Ops, plutôt qu'une suite complète.
5. **Tarif positionné pour la PME.**
6. **Expérience française native** : interface, support, facturation en euros.

**Ambition de départ réaliste** : sécuriser **20 à 30 PME françaises payantes** — un segment que les
acteurs US financés ont peu d'intérêt à adresser.

## 8. État du produit (juillet 2026)

- **MVP fonctionnel de bout en bout**, organisé en trois actes :
  - **Analyser** : transcription → analyse IA (dimensions sourcées + signaux comportementaux + métriques
    déterministes) → assistant (note de synthèse, tâches dans la file « À faire », points de suivi).
  - **Piloter** : pages Deals (tri par risque, statuts, momentum), hygiène de pipeline (détection d'écarts
    + correction 1 clic), exit-criteria par phase, couche de fiabilité du forecast.
  - **Coacher** : alerte de décrochage actionnable, briefing « Préparer un 1:1 », profil de coaching par
    commercial.
- **Sources d'entrée** : téléphonie (Ringover, Aircall) et visio (Google Meet), via une abstraction
  « source d'enregistrement » commune.
- **Intégrations CRM** : HubSpot et Pipedrive (via une abstraction CRM générique, connexion OAuth),
  push automatique des notes et tâches post-appel + cartes contact/deal côté CRM.
- **Stack** : Next.js 16, Supabase (Paris), AssemblyAI (EU), Claude Haiku, hébergé sur Vercel ;
  paiement Stripe en mode test.
- **Encore à faire** : premier client payant ; validation des intégrations téléphonie sur les données
  réelles d'un client (le pipeline est aujourd'hui exercé via un simulateur multi-source) ; finalisation
  facturation et cadre juridique.
- **Équipe** : Nizar, fondateur solo, non technique, construit le produit en pilotant une IA de développement.

## 9. Objectif GTM

Définir comment trouver et convaincre les **premières PME françaises** correspondant à la cible
(5–50 commerciaux, sous Ringover/Aircall, sans Rev Ops), et idéalement recruter quelques **design
partners** pour valider le produit sur de vraies conversations clients avant de passer à l'échelle.
