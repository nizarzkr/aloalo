-- ============================================================================
-- Aloalo — Migration 0031 : complétion des tâches « À faire »
-- Date  : 2026-06-18
-- J-day : J37 — « À faire » (axe Travailler, productivité commerciale)
-- ============================================================================
-- Contexte : l'IA produit déjà, par appel, des tâches de suivi datées
-- (analyses.suggested_tasks). La page « À faire » les agrège en une file unique
-- et COCHABLE par commercial. Comme les tâches suggérées n'ont pas d'identifiant
-- propre, on identifie une tâche par (call_id, task_key) où task_key = le titre
-- normalisé. Cette table mémorise UNIQUEMENT les tâches cochées « faites » par un
-- utilisateur (l'absence de ligne = à faire).
--
-- Sécurité — RLS SERVER-ONLY (cohérent avec coaching_sessions / 0030) : RLS
-- activée + forcée, AUCUNE policy, revoke à authenticated. Lecture/écriture via
-- le client admin, gating user_id = soi-même en couche applicative (server
-- action). Donnée perso et peu sensible, mais on garde le pattern homogène.
-- ============================================================================

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  call_id uuid not null references public.calls (id) on delete cascade,
  -- Identité stable de la tâche dans l'appel = titre normalisé (cap 300 car.).
  task_key text not null,
  done_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Une tâche d'un appel n'est cochée qu'une fois par utilisateur.
  unique (user_id, call_id, task_key)
);

comment on table public.task_completions is
  'J37 — tâches « À faire » (suggested_tasks) cochées comme faites par un utilisateur. Présence de ligne = fait. RLS server-only.';

-- Lecture rapide du À-faire d'un utilisateur.
create index if not exists task_completions_org_user_idx
  on public.task_completions (organization_id, user_id);

-- RLS : activée + forcée, aucune policy → server-only (defense-in-depth).
alter table public.task_completions enable row level security;
alter table public.task_completions force row level security;

revoke all on public.task_completions from authenticated;
