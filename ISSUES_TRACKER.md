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
- [ ] **#9** 🟡 Exiger le rôle owner sur les routes de facturation Stripe `security`
- [ ] **#13** 🟡 Remonter les échecs de transcription : error_message, alerte Sentry, retry `reliability`
- [ ] **#14** 🟡 Renseigner `calls.user_id` à l'insert (profils par commercial / ownership deals vides) `reliability`
- [ ] **#16** 🟡 Ajouter du rate limiting sur les Server Actions login/signup `security`
- [ ] **#17** 🟡 Cadenasser le simulateur d'appel DEV-ONLY hors production `ops` `security`
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
- **13 / 34** issues fermées · **5** reportées (section ⏸️ ci-dessus) · **16** actives restantes.
- **Prochaine issue : #9** → nouvelle session → `please ship issue #9 directly to main`

*Source : EPIC #35 — audit pré-PoC du 2026-06-08. Rapport complet dans `AUDIT_REPORT.md` (non committé).*
