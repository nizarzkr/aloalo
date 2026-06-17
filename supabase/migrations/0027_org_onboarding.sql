-- ============================================================================
-- Aloalo — Migration 0027 : drapeau de complétion de l'onboarding par org
-- Date  : 2026-06-17
-- J-day : J29 (Semaine 4) — Socle #3 (3/3) : le parcours d'onboarding assisté IA
-- ============================================================================
-- Contexte : J27 a capté la carte du tunnel, J28 les critères de sortie. J29
-- assemble téléphonie + HubSpot + critères dans un assistant guidé (/onboarding),
-- premier moment « waouh » du produit.
--
-- La PROGRESSION du parcours est calculée à la volée depuis les signaux réels
-- (clé Ringover présente ? tunnel synchronisé ? critères enregistrés ?) — cf.
-- lib/onboarding.ts. On évite ainsi un doublon de vérité (même principe que
-- J27/J28). Une étape « faite » = son signal réel est présent ; la reprise se
-- recale donc toute seule, même si l'owner abandonne en cours de route.
--
-- Cette colonne ne stocke donc PAS un pointeur d'étape — juste un horodatage de
-- complétion : tant qu'il est NULL, l'owner est redirigé vers /onboarding (sauf
-- s'il a cliqué « passer pour l'instant », géré par un cookie, pas par la DB).
-- Une fois l'assistant terminé, on l'horodate → plus de redirection ni de
-- bandeau de reprise.
--
-- Nullable : NULL = jamais terminé. `add column if not exists` → idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.organizations.onboarding_completed_at is
  'Horodatage de fin du parcours d''onboarding assisté (J29). NULL = non terminé → l''owner est redirigé vers /onboarding (sauf snooze par cookie). La progression par étape est calculée depuis les signaux réels (lib/onboarding.ts), pas stockée ici.';
