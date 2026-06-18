-- ============================================================================
-- Aloalo — Migration 0032 : jetons OAuth HubSpot par organisation
-- Date  : 2026-06-18
-- J-day : J38 (Semaine 5+) — HubSpot Public App + OAuth
-- ============================================================================
-- Contexte : jusqu'ici chaque org collait à la main un « Private App token »
-- (colonne hubspot_token, chiffrée). Ce modèle n'est pas distribuable à des
-- clients. On passe à l'OAuth : le client clique « Connecter HubSpot », autorise,
-- et HubSpot renvoie un access_token court (~30 min) + un refresh_token longue
-- durée que notre serveur renouvelle tout seul (cf. lib/hubspot-oauth.ts).
--
-- COHABITATION (non destructif) : on AJOUTE trois colonnes sans toucher
-- hubspot_token. getHubspotToken() privilégie l'OAuth et retombe sur le legacy
-- tant qu'une org n'est pas (encore) connectée en OAuth → aucune rupture.
--
-- Sécurité : access_token et refresh_token sont des SECRETS → chiffrés au repos
-- au format `enc:v1:` (AES-256-GCM, lib/crypto/org-secrets.ts), comme
-- hubspot_token / ringover_api_key. expires_at n'est pas un secret (horodatage).
-- Aucune policy à ajouter : ces colonnes héritent du RLS de `organizations`
-- (lecture client = same-org, mais ces colonnes secrètes ne sont jamais
-- SELECTées côté client RLS — uniquement via le service key serveur, issue #5).
--
-- `add column if not exists` → migration idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists hubspot_access_token  text,
  add column if not exists hubspot_refresh_token text,
  add column if not exists hubspot_token_expires_at timestamptz;

comment on column public.organizations.hubspot_access_token is
  'Jeton d''accès OAuth HubSpot (court, ~30 min), chiffré enc:v1: (issue #5). Rafraîchi automatiquement par getHubspotToken() (lib/hubspot-oauth.ts). NULL = org non connectée en OAuth (repli éventuel sur hubspot_token legacy).';

comment on column public.organizations.hubspot_refresh_token is
  'Jeton de rafraîchissement OAuth HubSpot (longue durée), chiffré enc:v1: (issue #5). Sert à obtenir un nouvel access_token sans réautorisation du client. SECRET — jamais exposé au client.';

comment on column public.organizations.hubspot_token_expires_at is
  'Échéance de hubspot_access_token (now + expires_in - marge). getHubspotToken() rafraîchit dès que dépassée. NULL si pas de jeton OAuth.';
