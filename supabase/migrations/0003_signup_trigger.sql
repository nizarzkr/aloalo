-- ============================================================================
-- Aloalo — Migration 0003 : Trigger auto signup (organization + profile)
-- Date  : 2026-05-02 (J2)
-- ============================================================================
-- À chaque inscription dans auth.users, on crée automatiquement :
--   1. Une nouvelle organization (avec le nom d'entreprise fourni au signup)
--   2. Le profile correspondant, en role 'owner', lié à cette org
--
-- Les valeurs full_name et organization_name sont passées dans
-- raw_user_meta_data depuis le formulaire signup côté Next.js :
--
--   supabase.auth.signUp({
--     email, password,
--     options: { data: { full_name: '...', organization_name: '...' } }
--   })
-- ============================================================================


-- ============================================================================
-- FUNCTION : handle_new_user
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer            -- Bypass la RLS pour insérer dans organizations et profiles
set search_path = public    -- Évite les attaques de search_path
as $$
declare
  new_org_id uuid;
  user_full_name text;
  user_org_name text;
begin
  -- Récupère les métadonnées du signup (avec fallbacks de sécurité)
  user_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)   -- fallback : la partie avant @ de l'email
  );

  user_org_name := coalesce(
    new.raw_user_meta_data->>'organization_name',
    'Mon entreprise'                -- fallback : nom générique
  );

  -- 1. Créer l'organization
  insert into public.organizations (name)
  values (user_org_name)
  returning id into new_org_id;

  -- 2. Créer le profile lié, en role 'owner'
  insert into public.profiles (id, organization_id, email, full_name, role)
  values (new.id, new_org_id, new.email, user_full_name, 'owner');

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Crée auto une organization + un profile owner à chaque signup auth.users.';


-- ============================================================================
-- TRIGGER : on_auth_user_created
-- ============================================================================
-- AFTER INSERT : la fonction s'exécute APRÈS que la ligne auth.users soit créée.
-- Si la fonction plante, l'insertion auth.users est rollback automatiquement
-- (transaction atomique) → le signup échoue côté client. Comportement voulu.
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
