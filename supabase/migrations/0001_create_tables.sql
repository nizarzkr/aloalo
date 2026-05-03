-- ============================================================================
-- Aloalo — Migration 0001 : Création des 6 tables de base
-- Date  : 2026-05-02 (J2)
-- Auteur : Nizar + Claude (CTO)
-- ============================================================================
-- Ce script crée toute la structure de données du SaaS Aloalo.
-- Il est idempotent dans la mesure où on part d'une DB vierge — à exécuter
-- UNE SEULE FOIS dans le SQL Editor de Supabase.
--
-- Ordre logique :
--   1. organizations  (racine du tenant)
--   2. profiles       (lié à auth.users)
--   3. calls          (appels téléphoniques)
--   4. analyses       (1-to-1 avec calls)
--   5. usage_logs     (coûts API par org)
--   6. invitations    (J8)
--   + trigger générique updated_at
-- ============================================================================


-- ============================================================================
-- 1. ORGANIZATIONS — Les entreprises clientes (1 org = 1 compte Aloalo)
-- ============================================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,

  -- Stripe (rempli au J9)
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'canceled')),
  subscription_plan text not null default 'starter'
    check (subscription_plan in ('starter', 'growth', 'scale')),
  trial_ends_at timestamptz default (now() + interval '14 days'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'Entreprises clientes Aloalo. Racine du tenant multi-tenant.';


-- ============================================================================
-- 2. PROFILES — Profil étendu d'un utilisateur (lié à auth.users)
-- ============================================================================
-- L'id est égal à auth.users.id : c'est le pont avec Supabase Auth.
-- Quand un user signup, auth.users crée la ligne, et notre trigger (J2 étape 4)
-- créera automatiquement la ligne profile correspondante.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'sales'
    check (role in ('owner', 'manager', 'sales')),
  avatar_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_organization_id on public.profiles(organization_id);

comment on table public.profiles is
  'Profils utilisateurs étendus. id = auth.users.id (1-to-1 avec auth).';


-- ============================================================================
-- 3. CALLS — Appels téléphoniques (Ringover, Aircall ou simulés)
-- ============================================================================
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,

  -- Identifiant côté provider (Ringover/Aircall) — null si simulé
  external_id text,
  provider text default 'ringover'
    check (provider in ('ringover', 'aircall', 'simulated')),

  -- Métadonnées de l'appel
  direction text default 'outbound' check (direction in ('inbound', 'outbound')),
  contact_phone text,
  contact_name text,
  duration_seconds int,
  started_at timestamptz,

  -- Pipeline d'analyse
  status text not null default 'pending'
    check (status in ('pending', 'transcribing', 'transcribed', 'analyzing', 'analyzed', 'failed')),

  -- Audio + transcript
  audio_url text,             -- URL temporaire (supprimée après transcription pour RGPD)
  transcript_text text,
  transcript_segments jsonb,  -- diarisation AssemblyAI (qui parle quand)

  -- Erreurs éventuelles
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calls_organization_id on public.calls(organization_id);
create index idx_calls_user_id on public.calls(user_id);
create index idx_calls_status on public.calls(status);
create index idx_calls_started_at on public.calls(started_at desc);

comment on table public.calls is
  'Appels téléphoniques avec leur pipeline pending → transcribing → analyzed.';


-- ============================================================================
-- 4. ANALYSES — Résultats d'analyse IA d'un appel (1-to-1 avec call)
-- ============================================================================
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.calls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Scores 0-100
  score_global int check (score_global between 0 and 100),
  score_discovery int check (score_discovery between 0 and 100),
  score_qualification int check (score_qualification between 0 and 100),
  score_objection_handling int check (score_objection_handling between 0 and 100),
  score_closing int check (score_closing between 0 and 100),
  score_next_step int check (score_next_step between 0 and 100),

  -- Contenu textuel
  summary text,
  strengths jsonb,        -- [{ "point": "...", "citation": "..." }]
  weaknesses jsonb,
  coaching_advice jsonb,  -- [{ "advice": "...", "priority": "high" }]

  -- Méta IA
  model_used text default 'claude-haiku-4-5-20251001',
  cost_eur numeric(10, 6),

  created_at timestamptz not null default now()
);

create index idx_analyses_organization_id on public.analyses(organization_id);

comment on table public.analyses is
  'Analyses IA des appels. Une seule analyse par call (contrainte unique).';


-- ============================================================================
-- 5. USAGE_LOGS — Logs des coûts API par organisation
-- ============================================================================
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid references public.calls(id) on delete set null,

  service text not null
    check (service in ('assemblyai', 'anthropic', 'resend', 'stripe')),
  operation text not null,    -- 'transcription', 'analysis', 'email', etc.
  units numeric,              -- secondes audio, tokens, etc.
  cost_eur numeric(10, 6),
  metadata jsonb,

  created_at timestamptz not null default now()
);

create index idx_usage_logs_organization_id on public.usage_logs(organization_id);
create index idx_usage_logs_created_at on public.usage_logs(created_at desc);

comment on table public.usage_logs is
  'Tracking des coûts API par organisation (paywall + facturation).';


-- ============================================================================
-- 6. INVITATIONS — Liens d'invitation pour rejoindre une org (utilisé au J8)
-- ============================================================================
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'sales'
    check (role in ('owner', 'manager', 'sales')),
  invited_by uuid references public.profiles(id) on delete set null,

  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,

  created_at timestamptz not null default now()
);

create index idx_invitations_organization_id on public.invitations(organization_id);
create index idx_invitations_token on public.invitations(token);

comment on table public.invitations is
  'Invitations email pour faire rejoindre un user à une org.';


-- ============================================================================
-- TRIGGER GÉNÉRIQUE — updated_at auto-géré sur les tables qui en ont besoin
-- ============================================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_organizations
  before update on public.organizations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_calls
  before update on public.calls
  for each row execute function public.handle_updated_at();
