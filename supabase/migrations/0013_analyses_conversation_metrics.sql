-- ============================================================================
-- Aloalo — Migration 0013 : analyses.conversation_metrics (J20)
-- Date  : 2026-06-06
-- ============================================================================
-- Métriques conversationnelles DÉTERMINISTES d'un appel, calculées sans IA à
-- partir de la diarisation (`calls.transcript_segments`) : talk ratio,
-- nombre de tours de parole (« ping-pong »), plus long monologue, moment du
-- « jump to pitch », etc. Cf. lib/metrics/conversation.ts.
--
-- Pourquoi stocker une donnée recalculable à la volée :
--   1. Pilotage (J24) : trier/agréger des dizaines de deals par talk ratio ou
--      engagement directement en SQL, sans recharger tous les transcripts.
--   2. Historique : la donnée reste figée même si la logique de calcul évolue.
-- La page détail recalcule en SECOURS depuis les segments si la colonne est
-- nulle (anciens appels) → pas besoin de backfill pour l'affichage immédiat.
--
-- Forme du jsonb (cf. type ConversationMetrics) :
--   {
--     "commercial_speaker": "A",
--     "total_talk_ms": 0, "commercial_talk_ms": 0, "prospect_talk_ms": 0,
--     "talk_ratio": 0.0, "prospect_talk_ratio": 0.0,
--     "turns": 0, "avg_turn_ms": 0, "longest_monologue_ms": 0,
--     "jump_to_pitch_ms": null,
--     "flags": { "talk_ratio_high": false, "prospect_silent": false, "pitch_too_early": false }
--   }
--
-- Nullable (pas de default) : null = « pas encore calculé » (anciens appels),
-- distinct d'un objet à zéros (appel réellement sans parole). `if not exists`
-- rend la migration idempotente.
-- ============================================================================

alter table public.analyses
  add column if not exists conversation_metrics jsonb;

comment on column public.analyses.conversation_metrics is
  'Métriques conversationnelles déterministes calculées depuis la diarisation (talk ratio, tours de parole, monologue, jump-to-pitch). Cf. lib/metrics/conversation.ts. null = non calculé (anciens appels).';
