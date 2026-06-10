-- ============================================================================
-- Aloalo — Migration 0018 : colonne indexée pour retrouver un call par son
--                            transcript_id AssemblyAI (au lieu d'un scan jsonb)
-- Date  : 2026-06-10
-- ============================================================================
-- Contexte (audit pré-PoC #4) : le webhook /api/webhooks/assemblyai retrouvait
-- le call correspondant à un transcript_id en chargeant TOUTES les lignes
-- `calls` en status='transcribing' (cross-tenant) puis en filtrant en JS sur le
-- blob jsonb `transcript_segments`. C'est un full-scan cross-tenant, amplifié à
-- chaque requête (DoS) et sans index utilisable.
--
-- On ajoute une colonne dédiée + un index unique partiel (un transcript_id
-- AssemblyAI est unique côté provider) pour faire un lookup mono-ligne indexé.
-- ============================================================================

alter table public.calls
  add column assemblyai_transcript_id text;

-- Index unique partiel : ignore les lignes sans transcript (la majorité).
create unique index idx_calls_assemblyai_transcript_id
  on public.calls (assemblyai_transcript_id)
  where assemblyai_transcript_id is not null;

comment on column public.calls.assemblyai_transcript_id is
  'ID de transcription AssemblyAI, renseigné quand on lance une transcription réelle. Sert au webhook /api/webhooks/assemblyai à retrouver le call sans scan.';
