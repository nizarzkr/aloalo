-- ============================================================================
-- Aloalo — Migration 0019 : aligne le schéma `calls` sur le code applicatif
-- Date  : 2026-06-10
-- Issue : #6 (audit pré-PoC du 2026-06-08)
-- ============================================================================
-- Contexte : le code lit/écrit `callee_number` et `provider_call_id` (insert du
-- webhook Ringover, page Deals, analyse), mais la table créée en 0001 ne
-- définissait que `external_id` et `contact_phone`. Les colonnes réellement
-- utilisées avaient été ajoutées à la main dans la console Supabase, hors
-- migration → une DB reconstruite uniquement à partir de `supabase/migrations/`
-- ne pouvait pas faire tourner le pipeline d'appels (l'insert du webhook
-- échouait en « column does not exist », pending → transcribing cassé dès l'étape 1).
--
-- Cette migration recrée ces colonnes côté versionné. `if not exists` la rend
-- idempotente : no-op sur la DB live (qui les a déjà), création sur une DB neuve.
-- Le nettoyage des anciennes colonnes mortes (`external_id`/`contact_phone`) est
-- fait séparément en 0020 pour garder cette migration strictement additive.
-- ============================================================================

alter table public.calls
  add column if not exists provider_call_id text,
  add column if not exists callee_number text;

comment on column public.calls.provider_call_id is
  'Identifiant de l''appel côté provider (Ringover/Aircall). Null si simulé. Remplace l''ancien `external_id` (0001), jamais utilisé par le code.';
comment on column public.calls.callee_number is
  'Numéro appelé (to_number du webhook). Sert de clé de regroupement deal (repli si pas de deal_id) et de matching HubSpot. Remplace l''ancien `contact_phone` (0001).';
