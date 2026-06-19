-- ============================================================================
-- Aloalo — Migration 0036 : jetons OAuth Pipedrive + sélecteur de CRM
-- Date  : 2026-06-19
-- J-day : J46 (Semaine 5+) — Pipedrive comme 2ᵉ adaptateur CRM (abstraction J45)
-- ============================================================================
-- Contexte : J45 a posé l'interface CrmAdapter (lib/crm/) avec HubSpot comme 1ʳᵉ
-- implémentation. J46 branche Pipedrive via cette interface. L'org connecte son
-- compte Pipedrive en OAuth ; Pipedrive renvoie un access_token court (~1 h) + un
-- refresh_token (60 j, qui SE RÉGÉNÈRE à chaque usage) que notre serveur renouvelle
-- tout seul (cf. lib/pipedrive-oauth.ts).
--
-- ⚠️ Différence majeure Pipedrive vs HubSpot : le endpoint /token renvoie un
--   `api_domain` PROPRE À LA SOCIÉTÉ (ex. https://acme.pipedrive.com) sur lequel
--   TOUS les appels API suivants doivent partir. On le stocke donc (NON secret).
--
-- Même modèle de secrets que 0032 (HubSpot) / 0033 (Google) :
--   access_token / refresh_token sont des SECRETS → chiffrés au repos au format
--   `enc:v1:` (AES-256-GCM, lib/crypto/org-secrets.ts). expires_at = horodatage,
--   api_domain / company_id = données d'affichage (pas des secrets).
--
-- `crm_provider` : sélecteur d'adaptateur lu par getCrmAdapter() (lib/crm/index.ts).
--   Défaut 'hubspot' → AUCUN changement de comportement pour les orgs existantes.
--   Posé à 'pipedrive' au succès de l'OAuth Pipedrive ; remis à 'hubspot' à la
--   déconnexion. (Une org ne pilote qu'un CRM à la fois : le dernier connecté gagne.)
--
-- Aucune policy à ajouter : ces colonnes héritent du RLS de `organizations` et les
-- colonnes secrètes ne sont jamais SELECTées côté client RLS (service key, issue #5).
-- `add column if not exists` → migration idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists pipedrive_access_token   text,
  add column if not exists pipedrive_refresh_token  text,
  add column if not exists pipedrive_token_expires_at timestamptz,
  add column if not exists pipedrive_api_domain     text,
  add column if not exists pipedrive_company_id     text,
  add column if not exists crm_provider             text not null default 'hubspot';

comment on column public.organizations.pipedrive_access_token is
  'Jeton d''accès OAuth Pipedrive (court, ~1 h), chiffré enc:v1: (issue #5). Rafraîchi automatiquement par getPipedriveContext() (lib/pipedrive-oauth.ts). NULL = org non connectée à Pipedrive.';

comment on column public.organizations.pipedrive_refresh_token is
  'Jeton de rafraîchissement OAuth Pipedrive (60 j, se régénère à chaque usage), chiffré enc:v1:. SECRET — jamais exposé au client. Réécrit à chaque refresh (Pipedrive en renvoie un nouveau, ≠ Google).';

comment on column public.organizations.pipedrive_token_expires_at is
  'Échéance de pipedrive_access_token (now + expires_in - marge). getPipedriveContext() rafraîchit dès que dépassée. NULL si pas de jeton Pipedrive.';

comment on column public.organizations.pipedrive_api_domain is
  'Base d''URL API propre à la société Pipedrive (ex. https://acme.pipedrive.com), renvoyée par le endpoint /token. TOUS les appels API v2 partent dessus. NON secret. NULL si non connecté.';

comment on column public.organizations.pipedrive_company_id is
  'Identifiant de la société Pipedrive connectée (affichage/diagnostic). NON secret. NULL si non connecté.';

comment on column public.organizations.crm_provider is
  'CRM piloté par l''org : ''hubspot'' (défaut) ou ''pipedrive''. Lu par getCrmAdapter() (lib/crm/index.ts) pour choisir l''adaptateur. Posé au succès OAuth, remis à ''hubspot'' à la déconnexion Pipedrive.';
