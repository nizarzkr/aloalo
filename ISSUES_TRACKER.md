# Suivi des issues — Audit pré-PoC (2026-06-08)

Ordre de traitement recommandé par l'EPIC **#35**.
**Règle d'or :** une issue à la fois, dans une **nouvelle session** Claude Code, en **mode plan**.

**Commande à taper pour chaque issue :**
```
please ship issue #N directly to main
```

**Légende sévérité :** 🔴 critical · 🟠 high · 🟡 medium · ⚪ low

> ⚠️ Verdict de l'audit : **ne pas ouvrir le PoC à des utilisateurs externes tant que le 🔴 critical et les 🟠 high ne sont pas fermés.**
> Quand une issue est faite : coche-la ici **ET** dans l'EPIC #35 sur GitHub.

---

## Phase 1 — Brèches multi-tenant & auth (les plus urgentes)
- [x] **#1** 🔴 RLS : empêcher un user de modifier son propre rôle / organization_id `security`
- [x] **#3** 🟠 Endpoints carte HubSpot : passer en « fail closed » + retirer crm-card déprécié `security`
- [x] **#5** 🟠 Protéger les credentials Ringover/HubSpot des clients (plaintext + lisibles par tous) `security` `gdpr`

## Phase 2 — Pipeline non authentifié
- [x] **#2** 🟠 Authentifier les routes internes /api/transcribe et /api/analyze `security`
- [x] **#4** 🟠 Sécuriser le webhook AssemblyAI : signature + rate limit + lookup indexé `security` `reliability`
- [x] **#15** 🟡 Le rate limiter doit « fail closed » (ou alerter) en prod si Upstash absent `ops` `security`

## Phase 3 — Intégrité des données & fiabilité
- [x] **#6** 🟠 Réconcilier le schéma `calls` : migrations manquantes callee_number / provider_call_id `reliability`
- [x] **#8** 🟡 Durcir le webhook Ringover : binding org, idempotence, signature `security` `reliability`
- [x] **#10** 🟡 Envelopper les triggers du pipeline dans `after()` (survie au gel serverless) `reliability`
- [x] **#11** 🟡 Rendre les transitions de statut atomiques (compare-and-set) — stop double facturation `reliability`
- [x] **#12** 🟡 Ajouter un sweeper pour les appels bloqués en `transcribing` (webhook manqué) `reliability`
  - **En clair :** Quand un vrai appel part en transcription, c'est le prestataire (AssemblyAI) qui doit nous rappeler pour dire « c'est fini ». Si ce coup de fil se perd, l'appel reste bloqué sur l'écran « transcription en cours… » pour toujours, sans message d'erreur — et rien ne le débloque.
  - **Ce qu'on a fait :** On a ajouté un petit gardien automatique qui passe toutes les 5 minutes. Il repère les appels coincés depuis plus de 15 min, tente une dernière fois de récupérer la transcription, et s'il n'y arrive pas, marque l'appel comme « échoué » avec une explication. Résultat : plus d'appel bloqué à l'infini. (⚠️ action de ton côté : ajouter la variable `CRON_SECRET` dans Vercel.)

## Phase 4 — Vie privée / légal & ops
- [x] **#7** 🟠 Bump Next.js 16.2.4 → 16.2.7 (clore les advisories HIGH) `dependencies` `security`
  - **En clair :** Next.js est le « moteur » sur lequel tout le site tourne. Ses créateurs ont publié un correctif qui bouche 4 trous de sécurité connus, dont un qui aurait pu laisser une requête atteindre une page protégée (`/dashboard/*`) sans passer le contrôle d'accès. On était une mini-version en retard.
  - **Ce qu'on a fait :** On a pris la mise à jour gratuite (16.2.4 → 16.2.7, un simple « patch » sans changement de comportement). Les alertes de sécurité HIGH sur le moteur ont disparu, l'app se construit et se vérifie sans erreur. Bonus : on a branché un petit robot (« Dependabot ») qui surveillera chaque semaine et proposera tout seul les prochains correctifs de sécurité — pour ne plus jamais être en retard sans le savoir.
- [x] **#18** 🟡 Ajouter un workflow CI + protection de branche sur `main` `ops`
  - **En clair :** Jusqu'ici, dès que du code était envoyé, il partait en ligne tout de suite — aucun robot ne le relisait avant. Une faute de frappe qui casse l'appli pouvait donc atteindre les utilisateurs sans que personne s'en aperçoive.
  - **Ce qu'on a fait :** On a embauché un « robot vérificateur » (GitHub Actions) qui, à chaque envoi de code, rejoue trois contrôles — relecture du style (lint), vérification des types, et construction complète de l'appli. S'il trouve un problème, il lève un drapeau rouge avant la mise en ligne. En branchant ce robot, on a aussi découvert et corrigé 2 petites scories dans le code existant (un apostrophe mal échappé, un import inutilisé), et calmé une alerte React trop zélée (passée d'« erreur » à simple « avertissement » : le code visé marche très bien et le commentaire explique pourquoi). Côté build, on a aussi appris au garde-fou anti-abus (rate limiter) à ne pas se saborder pendant la *compilation* de l'appli (il reste pleinement actif en production réelle).
  - **⏸️ Partie 2 reportée (décision founder 2026-06-10) :** la *protection de branche* (bloquer un push/merge quand la CI est rouge) est gated derrière GitHub Pro pour un repo **privé** → impossible à activer sur le plan gratuit actuel. Pas bloquant : la CI tourne déjà à chaque push et signale les échecs. **À ressortir** quand (a) un coéquipier rejoint et ouvre des PR, ou (b) on passe en repo public / GitHub Pro. Cmd alors : `gh api -X POST repos/nizarzkr/aloalo/rulesets ...` en exigeant le check `build`.

## Phase 5 — Tout le reste (medium → low)

### Medium restantes
- [x] **#9** 🟡 Exiger le rôle owner sur les routes de facturation Stripe `security`
  - **En clair :** Jusqu'ici, n'importe qui dans l'équipe — y compris un simple commercial — pouvait, en se connectant, changer le plan de l'entreprise, lancer un abonnement payant, ou carrément annuler l'abonnement depuis l'espace Stripe. Le système vérifiait bien « est-ce un membre de cette entreprise ? » mais jamais « est-ce le patron du compte ? ». Risque : un changement de plan accidentel, des frais surprises, ou une annulation — le tout sur le dos de l'entreprise.
  - **Ce qu'on a fait :** On a posé un videur à l'entrée des trois portes de facturation : si la personne n'est pas le propriétaire du compte (`owner`), elle est refoulée (erreur 403) **avant même** que la moindre opération Stripe ne parte. C'est le vrai verrou. En complément, on a aussi grisé les boutons côté écran pour un non-propriétaire (il voit la facturation en lecture seule, avec la mention « Réservé au propriétaire ») — une seconde barrière, par prudence. Aucune base de données touchée, aucune nouvelle clé à configurer.
- [x] **#13** 🟡 Remonter les échecs de transcription : error_message, alerte Sentry, retry `reliability`
  - **En clair :** Quand la transcription d'un appel plantait, l'appel virait au rouge « Échec »… mais sans dire pourquoi, sans nous prévenir, et sans aucun moyen de réessayer. L'appel (payé) était silencieusement perdu, et nous (l'équipe) n'étions jamais alertés. Bizarrement, l'étape *suivante* (l'analyse par l'IA) faisait déjà tout ça bien — c'est juste l'étape transcription qu'on avait oublié de soigner.
  - **Ce qu'on a fait :** Trois choses. (1) On enregistre désormais une **raison lisible** de l'échec (« audio illisible », « audio introuvable », etc.) qui s'affiche directement sur la page de l'appel. (2) Chaque échec déclenche une **alerte automatique** vers notre outil de surveillance (Sentry), donc on est prévenu en temps réel. (3) On a ajouté un bouton **« Relancer la transcription »** sur les appels échoués : un clic remet l'appel en file d'attente et retente le tout — l'écran d'avancement reprend la main. Aucune base de données touchée, aucune nouvelle clé à configurer.
- [x] **#14** 🟡 Renseigner `calls.user_id` à l'insert (profils par commercial / ownership deals vides) `reliability`
  - **En clair :** Chaque appel enregistré aurait dû mémoriser *quel commercial* l'a passé. La case prévue pour ça (`user_id`) existait bien dans la base, mais personne ne la remplissait — elle restait toujours vide. Résultat : quand on ouvrait la fiche d'un commercial, elle affichait 0 appel, 0 score moyen, 0 minute ; et sur la page des deals, chaque affaire affichait « aucun propriétaire ». L'info existait (on savait qui était connecté en lançant l'appel), on oubliait juste de l'écrire.
  - **Ce qu'on a fait :** On a fait passer l'identité du commercial du début à la fin de la chaîne. (1) Le simulateur d'appel attribue maintenant l'appel à la personne connectée qui le déclenche. (2) Le « formulaire » qui valide les appels entrants accepte désormais ce champ (et refuse une valeur mal formée). (3) Au moment d'enregistrer l'appel, on inscrit le commercial quand on le connaît. Du coup la fiche commercial et le propriétaire des deals s'affichent enfin. Pour un *vrai* appel Ringover, on laisse la case vide pour l'instant : relier l'agent Ringover à un membre de l'équipe est un chantier séparé, noté en commentaire. Aucune base de données modifiée, aucune nouvelle clé à configurer.
- [x] **#16** 🟡 Ajouter du rate limiting sur les Server Actions login/signup `security`
  - **En clair :** Les deux portes d'entrée du compte — la connexion et la création de compte — n'avaient aucun « videur » pour limiter le nombre d'essais, alors que toutes les autres entrées de l'app en avaient déjà un. Conséquence : quelqu'un pouvait (1) tenter des milliers de mots de passe à la suite sur une adresse email pour la pirater, ou (2) spammer le formulaire d'inscription pour créer des centaines de faux comptes — chacun gonflant la base de données et déclenchant un email de confirmation (coût + risque pour notre réputation d'expéditeur).
  - **Ce qu'on a fait :** On a posé un compteur d'essais sur ces deux portes : **5 tentatives maximum par minute** depuis une même connexion internet. À la 6e, la personne est refoulée avec un message clair (« Trop de tentatives. Réessayez dans une minute. ») et reste sur le bon formulaire. C'est le même mécanisme qui protège déjà le reste de l'app, juste réglé plus serré ici. En développement (sur ton ordi, sans le service de comptage branché), tout marche normalement sans limite — la protection ne s'active qu'en ligne. Aucune base de données touchée, aucune nouvelle clé à configurer.
- [x] **#17** 🟡 Cadenasser le simulateur d'appel DEV-ONLY hors production `ops` `security`
  - **En clair :** On avait un outil de test interne (un « simulateur d'appel ») qui fabrique de faux appels pour découvrir la plateforme sans avoir branché Ringover. Problème : cet outil partait en ligne avec le reste de l'appli, visible par les vrais clients. Pire, la page d'accueil des appels (quand on n'en a encore aucun) affichait un gros bouton « Simuler un appel » qui menait vers une page estampillée « DEV ONLY ». Conséquences : un client pouvait remplir ses propres statistiques de faux appels, et chaque clic déclenchait pour de vrai la transcription + l'analyse IA — donc des frais réels à chaque fois.
  - **Ce qu'on a fait :** On a posé un interrupteur d'environnement. L'outil reste pleinement actif sur ton ordi et sur les versions de test (« preview »), mais devient **totalement invisible en production** : la page renvoie une erreur 404 (page introuvable) et la « porte » technique qui crée les faux appels refuse net toute demande, avant même de dépenser quoi que ce soit. On a aussi retiré le bouton « Simuler un appel » de l'écran des vrais clients et reformulé le message d'accueil. Un interrupteur de secours existe (`ALLOW_DEV_SIMULATE`) pour rallumer l'outil le temps d'une démo ponctuelle, mais il reste éteint par défaut. Aucune base de données touchée, aucune nouvelle clé obligatoire à configurer.
- [ ] **#19** 🟡 Validation fail-fast des variables d'env au démarrage `ops`
- [ ] **#20** 🟡 Plafonds de dépense IA + alerting `ops`

### Low
- [ ] **#25** ⚪ Durcissement auth : validation mot de passe serveur, erreurs génériques, garde open-redirect `security`
- [ ] **#26** ⚪ RLS defense-in-depth : FORCE RLS, privilèges colonnes, CHECK, test de régression `security`
- [ ] **#27** ⚪ Durcissement observabilité : scrub PII Sentry + région EU, error-boundary, warnings env `ops`
- [ ] **#28** ⚪ Défense anti prompt-injection + assainir la sortie IA écrite vers HubSpot `security`
- [ ] **#29** ⚪ Empêcher /api/analyze de renvoyer le texte d'erreur brut du provider `security`
- [ ] **#30** ⚪ Proxy : exclure /api du matcher + resserrer la regex d'exclusion d'assets `ops` `reliability`
- [ ] **#31** ⚪ Garde de cycle de vie sur le polling statut/activité (cap, backoff, pause visibilité) `reliability`
- [ ] **#32** ⚪ Hygiène des dépendances : override uuid, pin deps carte HubSpot + lockfile, pin Stripe apiVersion `dependencies`
- [ ] **#33** ⚪ Docs : réécrire README, corriger noms de secrets RUNBOOK, runbook backup/restore `docs`

---

## ⏸️ Reporté — à traiter à l'ouverture commerciale (1ers clients payants)

Issues administratives / légales / RGPD parquées sur décision du founder (2026-06-10) : non urgentes tant qu'on est en phase MVP (démos + POC gratuits). À ressortir avant l'ouverture commerciale.

> ⚠️ **Nuance RGPD :** le RGPD ne se déclenche pas au paiement mais dès qu'on traite des données personnelles réelles. Avant le **premier POC avec de vrais enregistrements d'appels**, décider consciemment de **#23** et **#21** — quitte à les gérer à la main / par écrit dans l'accord de POC plutôt qu'en code.

- [ ] **#22** 🟡 Remplir les placeholders légaux (mentions légales + responsable de traitement) `gdpr` `docs` — bloquée tant que la structure n'est pas immatriculée (pas de SIRET). Cf. commentaire GitHub.
- [ ] **#21** 🟡 Implémenter et PLANIFIER les jobs RGPD de rétention & effacement `gdpr` `reliability` — la page privacy promet déjà la suppression auto ; gérable à la main en POC.
- [ ] **#23** 🟡 Capturer l'attestation de consentement à l'enregistrement (owner de l'org) `gdpr` — couvrable par écrit dans l'accord de POC au début.
- [ ] **#24** 🟡 Export d'accès/portabilité des données (RGPD Art. 15/20) `gdpr` — une demande se traite à la main au début.
- [ ] **#34** ⚪ Durcir le cron delete-old-audio + corriger l'edge case orphan-org `reliability` `gdpr` — pur durcissement, faible enjeu.

---

## Progression
- **18 / 34** issues fermées · **5** reportées (section ⏸️ ci-dessus) · **11** actives restantes.
- **Prochaine issue : #19** → nouvelle session → `please ship issue #19 directly to main`

*Source : EPIC #35 — audit pré-PoC du 2026-06-08. Rapport complet dans `AUDIT_REPORT.md` (non committé).*
