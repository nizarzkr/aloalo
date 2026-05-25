-- ============================================================================
-- Aloalo — Migration 0009 : organizations.hubspot_token + hubspot_portal_id (J15)
-- Date  : 2026-05-25
-- ============================================================================
-- Intégration HubSpot. Même logique que ringover_api_key (migration 0006) :
-- pas de compte HubSpot central, chaque client connecte son propre portail.
--
-- 1. hubspot_token : Private App token HubSpot du client (Bearer token).
--    Stocké en clair côté DB, jamais renvoyé au client. Lecture exclusivement
--    côté serveur (Server Actions, sync), bypass RLS via la clé secrète Supabase.
--
-- 2. hubspot_portal_id : ID du portail (Hub ID) HubSpot du client. Identifie
--    le compte HubSpot cible — sert à construire les liens vers les contacts/deals
--    et à vérifier à quel portail le token est rattaché.
--
-- `add column if not exists` rend la migration idempotente — on peut la
-- rejouer sans casser si la colonne a été créée à la main.
-- ============================================================================

alter table public.organizations
  add column if not exists hubspot_token text;

alter table public.organizations
  add column if not exists hubspot_portal_id text;

comment on column public.organizations.hubspot_token is
  'Private App token HubSpot du client (Bearer token). Stocké en clair, lecture serveur uniquement. Sert à pousser/lire les données CRM dans le portail du client.';

comment on column public.organizations.hubspot_portal_id is
  'ID du portail (Hub ID) HubSpot du client. Identifie le compte HubSpot cible — liens vers contacts/deals et rattachement du token.';
