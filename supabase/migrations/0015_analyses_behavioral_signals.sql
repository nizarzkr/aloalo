-- ============================================================================
-- Aloalo — Migration 0015 : analyses.behavioral_signals (J22)
-- Date  : 2026-06-06
-- ============================================================================
-- Signaux comportementaux QUALITATIFS détectés par l'IA dans le MÊME appel
-- Claude que l'analyse/les dimensions (donc sans coût supplémentaire). Deux
-- volets :
--   • Côté COMMERCIAL : ratio questions ouvertes/fermées, réaction au « trop
--     cher » (creusage/esquive/panique), tenue du silence après une objection.
--   • Côté PROSPECT (engagement) : signaux d'achat (buying signals) avec
--     citations, fermeté du next step, nature vraie/fausse de l'objection,
--     interruptions constructives.
--
-- Complète les métriques DÉTERMINISTES du J20 (conversation_metrics) : le J20
-- mesure le rythme (talk ratio, ping-pong), le J22 lit le SENS (intention,
-- engagement). Affichés ensemble dans l'onglet « Dynamique ».
--
-- Forme du jsonb (cf. type BehavioralSignals dans lib/claude.ts) :
--   {
--     "open_questions": 0, "closed_questions": 0,
--     "price_reaction": "creusage|esquive|panique|non_applicable",
--     "silence_after_objection": "encaisse|comble|non_applicable",
--     "buying_signals": [ { "quote": "…", "label": "Question d'implémentation" } ],
--     "next_step_firmness": "ferme|mou|absent",
--     "objection_nature": "vraie|fausse|aucune",
--     "objection_quote": "…",
--     "constructive_interruptions": 0
--   }
--
-- Nullable (pas de default) : null = analyse antérieure au J22. `if not exists`
-- rend la migration idempotente.
-- ============================================================================

alter table public.analyses
  add column if not exists behavioral_signals jsonb;

comment on column public.analyses.behavioral_signals is
  'Signaux comportementaux qualitatifs détectés par l''IA (réaction prix, silence après objection, buying signals, fermeté next step, nature de l''objection, interruptions). Cf. lib/claude.ts BehavioralSignals. null = analyse pré-J22.';
