-- ============================================================================
-- Aloalo — Migration 0035 : rattachement d'un webhook Aircall à une org
-- Date  : 2026-06-18
-- J-day : J44 (Semaine 5+) — Aircall (téléphonie) via l'abstraction d'ingestion
-- ============================================================================
-- Contexte : on branche Aircall comme source d'enregistrement (abstraction J41),
-- même architecture que Ringover. Aircall envoie sur chaque webhook un `token`
-- unique (secret partagé propre à ce webhook) qui identifie l'org émettrice.
-- On dérive donc l'org à partir de ce token — sans faire confiance à un id du
-- body — exactement comme Ringover dérive l'org de ringover_account_id.
--
-- On stocke le SHA-256 du token (déterministe → indexable pour la recherche), et
-- PAS le token en clair : la possession du token reste l'unique preuve, mais la
-- colonne ne révèle pas le secret si la base fuite. `aircall` est déjà autorisé
-- dans le CHECK calls.provider (migration 0001) → aucune autre migration.
--
-- `add column if not exists` + `create index if not exists` → idempotent.
-- ============================================================================

alter table public.organizations
  add column if not exists aircall_webhook_token_hash text;

create index if not exists idx_org_aircall_token_hash
  on public.organizations(aircall_webhook_token_hash);

comment on column public.organizations.aircall_webhook_token_hash is
  'SHA-256 (hex) du token du webhook Aircall de l''org. Sert à dériver l''org sur /api/webhooks/aircall (lookup par hash) sans stocker le secret en clair. NULL = pas d''intégration Aircall configurée.';
