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
- [ ] **#4** 🟠 Sécuriser le webhook AssemblyAI : signature + rate limit + lookup indexé `security` `reliability`
- [ ] **#15** 🟡 Le rate limiter doit « fail closed » (ou alerter) en prod si Upstash absent `ops` `security`

## Phase 3 — Intégrité des données & fiabilité
- [ ] **#6** 🟠 Réconcilier le schéma `calls` : migrations manquantes callee_number / provider_call_id `reliability`
- [ ] **#8** 🟡 Durcir le webhook Ringover : binding org, idempotence, signature `security` `reliability`
- [ ] **#10** 🟡 Envelopper les triggers du pipeline dans `after()` (survie au gel serverless) `reliability`
- [ ] **#11** 🟡 Rendre les transitions de statut atomiques (compare-and-set) — stop double facturation `reliability`
- [ ] **#12** 🟡 Ajouter un sweeper pour les appels bloqués en `transcribing` (webhook manqué) `reliability`

## Phase 4 — Vie privée / légal & ops
- [ ] **#22** 🟡 Remplir les placeholders légaux (mentions légales + responsable de traitement) `gdpr` `docs`
- [ ] **#21** 🟡 Implémenter et PLANIFIER les jobs RGPD de rétention & effacement `gdpr` `reliability`
- [ ] **#23** 🟡 Capturer l'attestation de consentement à l'enregistrement (owner de l'org) `gdpr`
- [ ] **#7** 🟠 Bump Next.js 16.2.4 → 16.2.7 (clore les advisories HIGH) `dependencies` `security`
- [ ] **#18** 🟡 Ajouter un workflow CI + protection de branche sur `main` `ops`

## Phase 5 — Tout le reste (medium → low)

### Medium restantes
- [ ] **#9** 🟡 Exiger le rôle owner sur les routes de facturation Stripe `security`
- [ ] **#13** 🟡 Remonter les échecs de transcription : error_message, alerte Sentry, retry `reliability`
- [ ] **#14** 🟡 Renseigner `calls.user_id` à l'insert (profils par commercial / ownership deals vides) `reliability`
- [ ] **#16** 🟡 Ajouter du rate limiting sur les Server Actions login/signup `security`
- [ ] **#17** 🟡 Cadenasser le simulateur d'appel DEV-ONLY hors production `ops` `security`
- [ ] **#19** 🟡 Validation fail-fast des variables d'env au démarrage `ops`
- [ ] **#20** 🟡 Plafonds de dépense IA + alerting `ops`
- [ ] **#24** 🟡 Export d'accès/portabilité des données (RGPD Art. 15/20) `gdpr`

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
- [ ] **#34** ⚪ Durcir le cron delete-old-audio + corriger l'edge case orphan-org `reliability` `gdpr`

---

## Progression
- **4 / 34** issues fermées.
- **Prochaine issue : #4** → nouvelle session → `please ship issue #4 directly to main`

*Source : EPIC #35 — audit pré-PoC du 2026-06-08. Rapport complet dans `AUDIT_REPORT.md` (non committé).*
