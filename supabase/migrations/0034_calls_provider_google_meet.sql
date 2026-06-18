-- ============================================================================
-- Aloalo — Migration 0034 : autoriser le provider 'google_meet' sur calls
-- Date  : 2026-06-18
-- J-day : J43 (Semaine 5+) — Google Meet (2/2) : visio → appel analysé
-- ============================================================================
-- Contexte : J42 a branché la connexion Google + la lecture des transcriptions
-- Meet. J43 ingère une réunion Meet comme un appel (provider 'google_meet') via
-- l'abstraction d'ingestion (lib/ingestion). La contrainte CHECK de calls.provider
-- (migration 0001) n'autorisait que ringover/aircall/simulated → on l'élargit.
--
-- On reconstruit la contrainte (drop + add) : un CHECK n'est pas « modifiable »
-- en place. L'index unique partiel uniq_calls_provider_call (where provider <>
-- 'simulated', migration 0021) couvre déjà 'google_meet' → idempotence du polling
-- (ré-importer une réunion déjà ingérée = violation 23505 = doublon ignoré).
-- ============================================================================

alter table public.calls
  drop constraint if exists calls_provider_check;

alter table public.calls
  add constraint calls_provider_check
  check (provider in ('ringover', 'aircall', 'google_meet', 'simulated'));
