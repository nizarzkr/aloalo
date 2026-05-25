-- ============================================================================
-- Aloalo — Migration 0007 : organizations.ai_profile (J14)
-- Date  : 2026-05-25
-- ============================================================================
-- ai_profile : profil commercial de l'organisation utilisé pour contextualiser
-- l'analyse IA (Claude Haiku 4.5) des appels. Objet JSON libre regroupant les
-- infos métier que le modèle reçoit en system prompt à chaque analyse :
--   - activity     : secteur d'activité et description de l'activité (ex. "SaaS RH B2B")
--   - icp          : Ideal Customer Profile (cible commerciale)
--   - objections   : objections clients fréquentes
--   - offer        : description de l'offre commerciale
--   - value_prop   : proposition de valeur principale
--   - competitors  : concurrents principaux à surveiller
--   - methodology  : méthodologie de vente utilisée (BANT, MEDDIC, SPIN…)
--
-- Type `jsonb` plutôt que `json` : indexable, déduplique les clés, plus rapide
-- à lire — recommandation Postgres par défaut.
--
-- Pas de DEFAULT et nullable : une org sans profil renseigné aura
-- `ai_profile IS NULL` et l'analyse IA tombera sur un prompt générique.
--
-- `add column if not exists` rend la migration idempotente — on peut la
-- rejouer sans casser si la colonne a été créée à la main.
-- ============================================================================

alter table public.organizations
  add column if not exists ai_profile jsonb;

comment on column public.organizations.ai_profile is
  'Profil commercial de l''org (activity, icp, objections, offer, value_prop, competitors, methodology). Injecté dans le system prompt Claude lors de l''analyse d''un appel. NULL = pas de contexte métier renseigné.';
