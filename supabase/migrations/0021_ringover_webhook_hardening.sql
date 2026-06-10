-- ============================================================================
-- Aloalo — Migration 0021 : durcissement du webhook Ringover
-- Date  : 2026-06-10
-- Issue : #8 (audit pré-PoC du 2026-06-08)
-- ============================================================================
-- Objectif : couper deux brèches du handler /api/webhooks/ringover.
--   (1) Injection cross-tenant : le webhook prenait l'org cible dans le BODY
--       (organization_id), non lié au signataire. Désormais, pour un appel
--       RÉEL on dérive l'org côté serveur via l'identifiant de compte Ringover
--       transmis dans l'événement signé (ringover_account_id ci-dessous) — on
--       ne fait JAMAIS confiance au organization_id du body pour un appel réel.
--   (2) Idempotence : un même appel provider (retry/replay signé) doit donner
--       UNE seule ligne `calls` (sinon double transcription = double dépense).
--
-- NB : provider_call_id / callee_number existent déjà (migration 0019, issue #6)
-- → cette migration ne les recrée pas. Elle est strictement additive.
-- ============================================================================

-- 1. Identifiant du compte Ringover de l'org, pour rattacher un call.ended réel
--    au bon tenant côté serveur. Renseigné au branchement d'un compte Ringover
--    réel (form settings) — le nom exact du champ source côté payload Ringover
--    (call.account_id ici) sera confirmé/ajusté quand l'API réelle sera live.
alter table public.organizations
  add column if not exists ringover_account_id text;

create unique index if not exists idx_organizations_ringover_account_id
  on public.organizations(ringover_account_id)
  where ringover_account_id is not null;

comment on column public.organizations.ringover_account_id is
  'Identifiant du compte Ringover du client (transmis dans le webhook signé). Sert à dériver l''org côté serveur à la réception d''un call.ended réel — on ne fait jamais confiance au organization_id du body pour un appel réel (issue #8).';

-- 2. Idempotence : un même appel provider ne doit donner qu'une ligne calls.
--    Partiel car les appels simulés réutilisent des ids non garantis uniques
--    (`sim_<timestamp>`) → on les laisse en INSERT toujours-vrai.
create unique index if not exists uniq_calls_provider_call
  on public.calls(organization_id, provider_call_id)
  where provider <> 'simulated';
