-- ============================================================================
-- Aloalo — Migration 0012 : enrichissement HubSpot des appels (J18bis)
-- Date  : 2026-06-06
-- ============================================================================
-- Objectif : ne plus identifier un appel par un simple numéro de téléphone.
-- Quand l'org a connecté HubSpot, on résout le numéro de l'appel vers le CRM
-- pour récupérer le NOM du contact, son ENTREPRISE et le DEAL lié, et on les
-- stocke sur l'appel pour les afficher partout dans Aloalo (listes, détail).
--
-- L'enrichissement est écrit côté serveur uniquement :
--   - automatiquement dans le bloc after() de /api/analyze (nouveaux appels) ;
--   - à la demande via POST /api/calls/[id]/hubspot-refresh (bouton « Rafraîchir »).
--
-- Toutes les colonnes sont NULLABLES → les anciens appels (et ceux sans HubSpot)
-- restent valides et retombent sur l'affichage du numéro comme avant.
--
-- Rappel : `contact_name` (migration 0010) est désormais rempli avec le vrai
-- nom du contact HubSpot quand on le retrouve (firstname + lastname).
--
-- `add column if not exists` rend la migration idempotente.
-- ============================================================================

alter table public.calls
  add column if not exists company_name text,
  add column if not exists deal_name text,
  add column if not exists deal_id text,
  add column if not exists hubspot_contact_id text,
  add column if not exists hubspot_enriched_at timestamptz;

comment on column public.calls.company_name is
  'Nom de l''entreprise (company HubSpot) associée au contact de l''appel. Rempli côté serveur lors de l''enrichissement HubSpot. Null si pas de HubSpot / pas de company.';
comment on column public.calls.deal_name is
  'Nom du deal HubSpot le plus récent associé au contact de l''appel. Sert d''affichage. Null si pas de deal.';
comment on column public.calls.deal_id is
  'ID du deal HubSpot le plus récent associé au contact. Sert à construire le lien vers la fiche deal + cible des notes/tâches de suivi (sinon repli contact).';
comment on column public.calls.hubspot_contact_id is
  'ID du contact HubSpot retrouvé par le numéro de l''appel. Mis en cache ici pour les liens et le rafraîchissement.';
comment on column public.calls.hubspot_enriched_at is
  'Horodatage du dernier enrichissement HubSpot réussi (auto ou bouton Rafraîchir). Null = jamais enrichi.';
