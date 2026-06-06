-- ============================================================================
-- Aloalo — Migration 0014 : analyses.dimensions (J21)
-- Date  : 2026-06-06
-- ============================================================================
-- Scoring FACTUEL par dimensions (remplace l'affichage du score global /100,
-- jugé opaque). Pour chaque dimension d'un cadre de vente (MEDDIC/BANT),
-- l'IA ne donne plus un chiffre mais un STATUT vérifiable, une checklist de
-- critères remplis/non remplis, et une CITATION exacte qui le justifie. C'est
-- la preuve, pas le chiffre, qui crée la confiance.
--
-- On CONSERVE les colonnes score_* (et score_global) : elles ne sont plus
-- affichées sur la page détail mais restent calculées par Claude et servent
-- encore aux agrégats manager (dashboard, leaderboard, courbes) jusqu'à leur
-- refonte « pilotage » au J24.
--
-- Forme du jsonb (cf. type DimensionEval[] dans lib/claude.ts) :
--   [
--     {
--       "key": "discovery",                       -- discovery | qualification
--                                                 --   | objection_handling | closing | next_step
--       "status": "validé",                        -- validé | partiel | manqué
--       "criteria": [ { "label": "Questions ouvertes posées", "met": true }, … ],
--       "evidence": "citation exacte du transcript" -- ou null si absence/non applicable
--     }, …
--   ]
--
-- Nullable (pas de default) : null = analyse antérieure au J21 (la page
-- retombe alors sur l'ancien affichage par scores). `if not exists` rend la
-- migration idempotente.
-- ============================================================================

alter table public.analyses
  add column if not exists dimensions jsonb;

comment on column public.analyses.dimensions is
  'Scoring factuel par dimension (statut + checklist de critères + citation), produit par Claude. Remplace l''affichage du score /100 sur la page détail. Cf. lib/claude.ts DimensionEval. null = analyse pré-J21.';
