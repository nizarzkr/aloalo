-- ============================================================================
-- Aloalo — Migration 0006 : organizations.logo_url + ringover_api_key (J12)
-- Date  : 2026-05-12 (logo_url) / 2026-05-13 (ringover_api_key)
-- ============================================================================
-- 1. logo_url : permet à un owner de personnaliser l'identité visuelle de son
--    org via /dashboard/settings. MVP volontairement minimal : on stocke
--    juste une URL texte (pas d'upload Supabase Storage).
--
-- 2. ringover_api_key : décision archi 2026-05-13. Pas de compte Ringover
--    Developers central — chaque client connecte son propre Ringover via
--    sa propre clé. Stockée en clair côté DB, jamais renvoyée au client.
--    Lecture exclusivement côté serveur (Server Actions, webhook), bypass
--    RLS via la clé secrète Supabase.
--
-- `add column if not exists` rend la migration idempotente — on peut la
-- rejouer sans casser si la colonne a été créée à la main.
-- ============================================================================

alter table public.organizations
  add column if not exists logo_url text;

alter table public.organizations
  add column if not exists ringover_api_key text;

comment on column public.organizations.logo_url is
  'URL publique du logo de l''organisation (https://...). MVP : pas d''upload, juste un champ texte renseigné par l''owner.';

comment on column public.organizations.ringover_api_key is
  'Clé API Ringover du client (Bearer token). Stockée en clair, lecture serveur uniquement. Sert à récupérer l''URL de recording après réception d''un webhook call.ended.';
