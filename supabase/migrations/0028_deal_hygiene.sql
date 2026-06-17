-- ============================================================================
-- Aloalo — Migration 0028 : cache d'hygiène de pipeline par deal
-- Date  : 2026-06-17
-- J-day : J30 (Semaine 4) — #1 Pipeline Hygiene Engine (1/2) : moteur de détection
-- ============================================================================
-- Contexte : J30 détecte automatiquement les ÉCARTS dit/CRM par deal — la phase
-- HubSpot ne correspond pas à la réalité de l'appel, critères de sortie non
-- remplis, deal coincé sans next step. La détection croise des règles
-- déterministes + UNE passe IA légère (nourrie des artefacts déjà analysés, pas
-- de re-transcription).
--
-- Pourquoi une table de cache : un « deal » est une VUE AGRÉGÉE (pas de table
-- `deals` — regroupement à la volée par `deal:<id>` | `phone:<num>`). On persiste
-- le rapport d'hygiène par deal pour que J31 (écran manager + correction 1 clic)
-- n'ait qu'à LIRE, et pour ne PAS re-payer l'IA à chaque affichage.
--   - `calls_signature` : invalide le cache quand un nouvel appel arrive
--     (`<count>:<lastCallId>`).
--   - `criteria_fingerprint` : invalide le cache quand les critères de sortie de
--     la phase changent (rend trivial le « rafraîchir l'hygiène » de J31).
--   - `cost_eur` : null si aucun appel IA (deal sans HubSpot/critères = règles
--     déterministes seules, gratuit).
--
-- Sécurité (cohérent avec deal_pushed_actions / 0024) : RLS activée + forcée.
-- L'utilisateur ne fait que LIRE (affichage J31) ; l'écriture passe par le
-- serveur (secret key, bypass RLS).
-- ============================================================================

create table if not exists public.deal_hygiene (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Clé de regroupement du deal (identique partout : `deal:<hsId>` | `phone:<num>`).
  group_key text not null,
  -- Phase HubSpot (dealstage = id de phase) sur laquelle l'hygiène a été évaluée.
  stage_id text,
  -- Liste d'écarts typés et PRIORISÉS (cf. lib/hygiene/types.ts).
  gaps jsonb not null default '[]'::jsonb,
  -- Signatures d'invalidation de cache.
  calls_signature text,
  criteria_fingerprint text,
  -- Coût IA estimé du dernier calcul (null = aucun appel IA).
  cost_eur numeric,
  computed_at timestamptz not null default now(),
  -- Un seul rapport d'hygiène par deal et par org (upsert).
  unique (organization_id, group_key)
);

comment on table public.deal_hygiene is
  'J30 — cache du rapport d''hygiène de pipeline par deal (écarts dit/CRM priorisés). Un « deal » étant une vue agrégée, cette table persiste le rapport pour que J31 le LISE sans re-payer l''IA. Invalidé par calls_signature (nouvel appel) et criteria_fingerprint (critères modifiés).';

-- Lecture rapide de tous les rapports d'une org (futur écran manager J31).
create index if not exists deal_hygiene_org_idx
  on public.deal_hygiene (organization_id);

-- RLS : activée + forcée (defense-in-depth, cf. 0024). ----------------------
alter table public.deal_hygiene enable row level security;
alter table public.deal_hygiene force row level security;

-- SELECT scopé à l'org du JWT (helper SECURITY DEFINER de 0002, anti-récursion).
do $$ begin
  create policy "deal_hygiene_select_same_org"
    on public.deal_hygiene
    for select
    using (organization_id = public.user_organization_id());
exception when duplicate_object then null;
end $$;

-- Aucune policy INSERT/UPDATE/DELETE : seules les écritures serveur (secret key,
-- service_role, BYPASSRLS) peuvent écrire. Révocation explicite au rôle
-- authenticated (rend la règle infalsifiable, idempotent).
revoke insert, update, delete on public.deal_hygiene from authenticated;
