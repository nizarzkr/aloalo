-- ============================================================================
-- Aloalo — Migration 0008 : analyses.used_ai_profile (J14)
-- Date  : 2026-05-25
-- ============================================================================
-- Flag booléen qui indique si l'analyse a été générée avec le profil IA de
-- l'org injecté dans le prompt (true) ou avec un prompt générique (false).
--
-- Pourquoi en DB et pas seulement côté UI :
--   1. Audit : on peut comparer la qualité des analyses avec/sans profil
--      et démontrer la valeur ajoutée du profil IA aux clients
--   2. Réanalyse : si plus tard on rejoue une analyse après que l'owner a
--      rempli/modifié le profil, on saura que l'ancienne analyse est obsolète
--   3. Filtre dashboard : "voir uniquement les analyses contextualisées"
--
-- DEFAULT false : les analyses historiques (avant J14) sont sans profil. La
-- valeur sera explicitement settée à true par /api/analyze quand le profil
-- de l'org est non-vide au moment de l'analyse.
--
-- `add column if not exists` rend la migration idempotente.
-- ============================================================================

alter table public.analyses
  add column if not exists used_ai_profile boolean not null default false;

comment on column public.analyses.used_ai_profile is
  'true si l''analyse a été générée avec organizations.ai_profile injecté dans le prompt Claude ; false sinon. Permet audit et réanalyse si le profil change.';
