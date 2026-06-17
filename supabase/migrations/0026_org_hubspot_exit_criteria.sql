-- ============================================================================
-- Aloalo — Migration 0026 : critères de sortie de phase (exit criteria) par org
-- Date  : 2026-06-17
-- J-day : J28 (Semaine 4) — Socle #3 (2/3) : le cerveau exit-criteria
-- ============================================================================
-- Contexte : J27 a capté la CARTE du tunnel (organizations.hubspot_pipelines).
-- J28 ajoute, pour chaque PHASE OUVERTE, des « critères de sortie » : la check-
-- list objective qui dit quand un deal mérite d'avancer (« pour passer de Démo à
-- Proposition : budget confirmé + décideur identifié »). L'IA les propose à
-- l'onboarding, le client les valide/ajuste. Ils seront VÉRIFIÉS sur la
-- transcription en J30 (hygiène de pipeline) — d'où des critères DISCRETS avec
-- un `id` stable, pas un bloc de texte.
--
-- Choix de stockage : COLONNE JSONB DÉDIÉE, **séparée** du snapshot J27. Critique :
-- `hubspot_pipelines` est ré-écrasé à chaque re-synchro du tunnel (cf. 0025) ; si
-- on rangeait les critères dedans, une simple re-synchro effacerait le travail du
-- client. On les isole donc dans leur propre colonne, INDEXÉE PAR `id` DE PHASE
-- (la clé HubSpot du stage) → les critères survivent aux re-synchros, et une phase
-- supprimée côté HubSpot laisse seulement des critères orphelins inoffensifs
-- (filtrés à l'affichage par jointure avec le snapshot courant).
--
-- Forme du jsonb (objet indexé par stageId) :
--   {
--     "<stageId>": {
--       "criteria": [ { "id": "<uuid>", "label": "Budget confirmé" } ],
--       "ai_generated_at": "2026-06-17T..Z" | null,
--       "edited_at": "2026-06-17T..Z" | null
--     }
--   }
-- `edited_at` non-null = phase retouchée à la main → une régénération globale
-- l'épargne (on ne réécrase pas le travail du client sans ciblage explicite).
--
-- Nullable : une org sans tunnel synchronisé / sans critères générés n'a rien.
-- `add column if not exists` → migration idempotente.
-- ============================================================================

alter table public.organizations
  add column if not exists hubspot_exit_criteria jsonb;

comment on column public.organizations.hubspot_exit_criteria is
  'Critères de sortie par phase HubSpot (J28). Objet jsonb indexé par stageId : { "<stageId>": { criteria:[{id,label}], ai_generated_at, edited_at } }. Séparé du snapshot hubspot_pipelines pour survivre aux re-synchros du tunnel. Null si jamais généré.';
