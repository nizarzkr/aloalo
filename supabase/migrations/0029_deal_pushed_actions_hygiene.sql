-- ============================================================================
-- Aloalo — Migration 0029 : actions d'hygiène poussées dans HubSpot
-- Date  : 2026-06-17
-- J-day : J31 (Semaine 4) — #1 Pipeline Hygiene Engine (2/2) : surface + 1 clic
-- ============================================================================
-- Contexte : J30 détecte des ÉCARTS d'hygiène par deal (cf. deal_hygiene). J31
-- les rend ACTIONNABLES en 1 clic : chaque écart peut être poussé dans HubSpot
-- sous forme de TÂCHE de correction (réutilise lib/hubspot.createTask + le
-- pattern d'idempotence/traçabilité de deal_pushed_actions, J26 / migration 0024).
--
-- Pourquoi rien de plus qu'élargir une contrainte : un deal peut cumuler
-- PLUSIEURS écarts (phase ≠ réalité ET pas de next step…). On veut une trace
-- idempotente PAR écart, pas une seule « action d'hygiène » globale. La
-- contrainte d'unicité existante (organization_id, group_key, action_type) le
-- donne gratuitement si on encode le TYPE D'ÉCART dans action_type :
--   `hygiene:<gapType>` (ex. `hygiene:no_next_step`).
-- Re-cliquer sur la correction d'un écart donné ne crée jamais une 2ᵉ tâche ;
-- corriger un AUTRE écart du même deal reste possible.
--
-- Seule la liste blanche de la colonne action_type doit donc s'ouvrir. La
-- contrainte inline de 0024 (`check (action_type in ('coaching_task'))`) est
-- nommée par défaut `deal_pushed_actions_action_type_check` → on la remplace.
-- ============================================================================

alter table public.deal_pushed_actions
  drop constraint if exists deal_pushed_actions_action_type_check;

alter table public.deal_pushed_actions
  add constraint deal_pushed_actions_action_type_check
  check (
    action_type in (
      'coaching_task',                  -- J26 : alerte coaching → tâche de suivi
      'hygiene:stage_reality_mismatch', -- phase CRM ≠ réalité de l'appel
      'hygiene:exit_criteria_unmet',    -- critères de sortie de phase non remplis
      'hygiene:no_next_step',           -- deal actif sans prochaine étape datée
      'hygiene:dormant_open_deal',      -- deal ouvert sans activité récente
      'hygiene:stage_unmapped'          -- phase HubSpot non reconnue dans le tunnel
    )
  );

comment on column public.deal_pushed_actions.action_type is
  'Type d''action poussée. `coaching_task` (J26) ou `hygiene:<gapType>` (J31, une correction par type d''écart → idempotence par deal+écart via la contrainte unique).';
