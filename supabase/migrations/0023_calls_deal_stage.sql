-- ============================================================================
-- Aloalo — Migration 0023 : phase du deal HubSpot sur l'appel (J25 phase 2)
-- Date  : 2026-06-17
-- ============================================================================
-- Objectif : persister la PHASE du deal HubSpot (dealstage) au moment de
-- l'enrichissement, en plus de son nom/ID (migration 0012). Aujourd'hui le
-- statut d'un deal dans Aloalo est déduit de l'ACTIVITÉ (actif si dernier appel
-- récent, sinon dormant). Avec la phase HubSpot, on peut détecter le vrai
-- « gagné / perdu » des pipelines standard (stages `closedwon` / `closedlost`).
--
-- Pour les pipelines personnalisés (stages = identifiants GUID propres au
-- client), la cartographie complète du tunnel viendra en Semaine 4 (ingestion
-- des pipelines + stages). Ici on persiste seulement la valeur brute : aucun
-- mapping côté DB, l'interprétation se fait côté app (lib/deals/aggregate).
--
-- Colonne NULLABLE → anciens appels, appels simulés et appels sans HubSpot
-- restent valides et retombent sur le statut d'activité comme avant.
-- `add column if not exists` rend la migration idempotente.
-- ============================================================================

alter table public.calls
  add column if not exists deal_stage text;

comment on column public.calls.deal_stage is
  'Phase (dealstage) du deal HubSpot au dernier enrichissement. Valeur brute HubSpot (ex. closedwon/closedlost pour les pipelines standard, sinon ID de stage personnalisé). Null si pas de HubSpot / pas de deal. Sert à dériver gagné/perdu côté app (J25), avant la cartographie complète du tunnel (Semaine 4).';
