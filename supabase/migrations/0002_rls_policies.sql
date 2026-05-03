-- ============================================================================
-- Aloalo — Migration 0002 : Activation RLS + policies de base
-- Date  : 2026-05-02 (J2)
-- ============================================================================
-- Active Row Level Security sur les 6 tables publiques et crée les policies
-- pour garantir l'isolation multi-tenant : un user ne voit QUE les données de
-- son organisation.
--
-- Modèle :
--   - Les users LISENT (via clé publishable + leur session JWT)
--   - Notre serveur ÉCRIT (via secret key, bypass naturel de la RLS)
-- ============================================================================


-- ============================================================================
-- HELPER FUNCTION — récupère l'organization_id du user authentifié
-- ============================================================================
-- SECURITY DEFINER : la fonction s'exécute avec les droits du créateur
-- (postgres), elle peut donc lire profiles sans déclencher la RLS et éviter
-- la récursion infinie quand on l'appelle depuis une policy de profiles.
create or replace function public.user_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

comment on function public.user_organization_id is
  'Renvoie organization_id du user authentifié. Utilisé dans les policies RLS.';


-- ============================================================================
-- 1. ORGANIZATIONS
-- ============================================================================
alter table public.organizations enable row level security;

-- Lecture : un user peut voir UNIQUEMENT son organisation
create policy "Users can view their own organization"
  on public.organizations for select
  to authenticated
  using (id = public.user_organization_id());


-- ============================================================================
-- 2. PROFILES
-- ============================================================================
alter table public.profiles enable row level security;

-- Lecture : un user peut voir tous les profils de son organisation
-- (utile pour afficher l'équipe, les commerciaux, etc.)
create policy "Users can view profiles from their organization"
  on public.profiles for select
  to authenticated
  using (organization_id = public.user_organization_id());

-- Update : un user peut modifier son propre profil (nom, avatar, etc.)
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================================
-- 3. CALLS
-- ============================================================================
alter table public.calls enable row level security;

-- Lecture : un user peut voir tous les appels de son organisation
create policy "Users can view calls from their organization"
  on public.calls for select
  to authenticated
  using (organization_id = public.user_organization_id());

-- Note : pas de policy INSERT/UPDATE/DELETE
-- Les appels sont créés par notre webhook Ringover (J3) côté serveur,
-- qui utilise la secret key et bypass la RLS.


-- ============================================================================
-- 4. ANALYSES
-- ============================================================================
alter table public.analyses enable row level security;

-- Lecture : un user peut voir toutes les analyses de son organisation
create policy "Users can view analyses from their organization"
  on public.analyses for select
  to authenticated
  using (organization_id = public.user_organization_id());

-- Pas de policy INSERT/UPDATE/DELETE : créées par notre worker IA (J5).


-- ============================================================================
-- 5. USAGE_LOGS
-- ============================================================================
alter table public.usage_logs enable row level security;

-- Lecture : un user peut voir les logs de son organisation
-- (utilisé pour afficher la consommation dans /dashboard/billing)
create policy "Users can view usage_logs from their organization"
  on public.usage_logs for select
  to authenticated
  using (organization_id = public.user_organization_id());

-- Pas de policy INSERT : créés côté serveur uniquement.


-- ============================================================================
-- 6. INVITATIONS
-- ============================================================================
alter table public.invitations enable row level security;

-- Lecture : owners et managers peuvent voir les invitations de leur org
create policy "Owners and managers can view invitations"
  on public.invitations for select
  to authenticated
  using (
    organization_id = public.user_organization_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'manager')
    )
  );

-- Note : INSERT et DELETE seront ajoutés au J8 quand on activera les invitations.
