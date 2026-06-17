-- ============================================================================
-- Aloalo — Migration 0025 : carte du tunnel HubSpot par organisation
-- Date  : 2026-06-17
-- J-day : J27 (Semaine 4) — Socle #3 (1/3) : ingestion de la structure du tunnel
-- ============================================================================
-- Contexte : pour la « CRM Intelligence » (Semaine 4), Aloalo doit connaître la
-- CARTE COMPLÈTE du tunnel de chaque client — pas seulement le stage courant d'un
-- deal (déjà capté en J25 via calls.deal_stage). On lit `GET /crm/v3/pipelines/deals`
-- (pipelines + stages : id, libellé, ordre, isClosed, probabilité) et on en stocke
-- un instantané.
--
-- Choix de stockage (tranché avec Nizar) : COLONNE JSONB sur organizations, comme
-- `ai_profile`. Le tunnel se lit toujours en entier (1 org = 1 portail = 1 carte),
-- donc une table relationnelle dédiée serait inutilement lourde (garde-fou
-- « anti-explosion combinatoire » de la Semaine 4). Réversible : on pourra
-- normaliser plus tard sans casser cette structure.
--
-- Forme du jsonb (array de pipelines) :
--   [ { "id","label","displayOrder",
--       "stages": [ { "id","label","displayOrder","isClosed","probability" } ] } ]
--
-- Nullable : une org sans HubSpot connecté n'a pas de carte. Pas de default '[]'
-- pour distinguer « jamais synchronisé » (null) de « synchronisé, 0 pipeline »
-- (cas qui n'arrive pas en pratique — un portail a toujours le pipeline default).
-- `add column if not exists` → migration idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists hubspot_pipelines jsonb;

alter table public.organizations
  add column if not exists hubspot_pipelines_synced_at timestamptz;

comment on column public.organizations.hubspot_pipelines is
  'Instantané de la carte du tunnel HubSpot (deal pipelines + stages : id/label/displayOrder/isClosed/probability). Array jsonb, null si jamais synchronisé. Lu via GET /crm/v3/pipelines/deals (J27).';

comment on column public.organizations.hubspot_pipelines_synced_at is
  'Horodatage de la dernière lecture du tunnel HubSpot (J27).';
