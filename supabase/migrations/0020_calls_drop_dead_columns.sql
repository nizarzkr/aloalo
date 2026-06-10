-- ============================================================================
-- Aloalo — Migration 0020 : supprime les colonnes mortes de `calls`
-- Date  : 2026-06-10
-- Issue : #6 (cleanup de suivi prévu par l'issue)
-- ============================================================================
-- Contexte : 0001 définissait `external_id` et `contact_phone`. Le code ne les a
-- jamais utilisées (vérifié : 0 lecteur/écrivain dans le repo — les seuls hits
-- `hs_call_external_id` concernent HubSpot, sans rapport). La console Supabase
-- les avait déjà supprimées sur la DB live au profit de `provider_call_id` /
-- `callee_number` (recréées proprement en 0019).
--
-- On les retire donc aussi côté versionné pour qu'une DB neuve reconstruite
-- depuis les migrations soit identique à la live. `if exists` rend l'opération
-- idempotente et no-op sur la live (où ces colonnes n'existent plus).
-- ============================================================================

alter table public.calls
  drop column if exists external_id,
  drop column if exists contact_phone;
