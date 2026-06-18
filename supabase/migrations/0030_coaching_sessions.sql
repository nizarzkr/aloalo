-- ============================================================================
-- Aloalo — Migration 0030 : sessions de 1:1 (coaching manager)
-- Date  : 2026-06-18
-- J-day : J35 — « Préparer un 1:1 » (axe Coacher, le différenciateur)
-- ============================================================================
-- Contexte : un manager prépare ses 1:1 grâce à un briefing généré par
-- commercial, sur une PÉRIODE choisie (semaine/2 sem/mois/trimestre/année). On
-- STOCKE chaque 1:1 (instantané) pour (1) comparer dans le temps — « depuis ton
-- dernier 1:1 » — et (2) garder l'historique de progression. L'objectif est la
-- confiance et la transparence, pas le flicage.
--
-- Le `snapshot` jsonb contient le brief IA (wins, axe à travailler, encouragement)
-- + les agrégats déterministes (dimensions validées, tendance, deals à suivre).
-- `manager_notes` = ce que le manager ajoute pendant/après l'entretien.
--
-- Sécurité — RLS SERVER-ONLY (données RH sensibles, plus strict que deal_hygiene
-- /0028) : RLS activée + forcée, AUCUNE policy → aucun accès via le rôle
-- `authenticated`. Toute lecture/écriture passe par le client admin (secret key,
-- BYPASSRLS), avec un gating de rôle owner/manager en couche applicative. Ainsi
-- un commercial ne peut jamais lire en direct les 1:1 (les siens ou ceux des
-- collègues) — la vue côté commercial viendra plus tard, servie par le serveur.
-- ============================================================================

create table if not exists public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Commercial coaché + manager qui a préparé le 1:1.
  rep_user_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  -- Fenêtre d'analyse choisie par le manager.
  period_type text not null check (
    period_type in ('week', 'two_weeks', 'month', 'quarter', 'year')
  ),
  period_start timestamptz not null,
  period_end timestamptz not null,
  -- Brief généré + agrégats déterministes (cf. lib/coaching/one-on-one.ts).
  snapshot jsonb not null default '{}'::jsonb,
  -- Notes libres du manager (non négatif : texte). Vide par défaut.
  manager_notes text not null default '',
  -- Coût IA estimé (null si génération sans appel IA — période sans appels).
  cost_eur numeric,
  created_at timestamptz not null default now()
);

comment on table public.coaching_sessions is
  'J35 — instantané d''un 1:1 préparé par le manager pour un commercial, sur une période donnée. Stocké pour comparer dans le temps (« depuis le dernier 1:1 ») et garder l''historique de progression. RLS server-only : accès uniquement via le client admin + gating de rôle applicatif.';

-- Lecture de l'historique d'un commercial (le plus récent d'abord).
create index if not exists coaching_sessions_org_rep_idx
  on public.coaching_sessions (organization_id, rep_user_id, created_at desc);

-- RLS : activée + forcée, AUCUNE policy → server-only (defense-in-depth). -----
alter table public.coaching_sessions enable row level security;
alter table public.coaching_sessions force row level security;

-- Révocation explicite au rôle authenticated : aucun accès navigateur, jamais.
-- Les écritures/lectures passent par la secret key (service_role, BYPASSRLS).
revoke all on public.coaching_sessions from authenticated;
