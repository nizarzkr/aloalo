-- ============================================================================
-- Aloalo — Migration 0016 : verrouillage colonne-par-colonne de profiles
-- Date  : 2026-06-09
-- ============================================================================
-- La policy RLS "Users can update their own profile" (migration 0002) limite
-- la LIGNE (id = auth.uid()) mais PAS les COLONNES : RLS Postgres ne filtre pas
-- par colonne. Or par défaut Supabase accorde UPDATE sur TOUTES les colonnes
-- aux rôles `authenticated` ET `anon`. Sans verrou colonne, un user connecté
-- pouvait donc, avec la clé publishable (présente dans le bundle navigateur) :
--   update profiles set role = 'owner'                -> escalade de privilège
--   update profiles set organization_id = '<victime>' -> évasion multi-tenant
-- (après le swap, public.user_organization_id() renvoie l'org victime et
--  expose ses appels/transcriptions/analyses — fuite RGPD).
--
-- Les écritures LÉGITIMES de role/organization_id passent par le client admin
-- (SUPABASE_SECRET_KEY -> rôle service_role) : retrait de membre
-- (app/api/team/members/[id]/route.ts) et acceptation d'invitation
-- (app/api/invitations/[token]/accept/route.ts). Aucun chemin user-context ne
-- fait d'UPDATE sur profiles. On peut donc retirer le UPDATE table-wide sans
-- rien casser.
-- ============================================================================

-- 1. Retirer le droit UPDATE sur toute la table aux deux rôles exposés au
--    navigateur. NB : `anon` aussi a le GRANT par défaut (vérifié en base).
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

-- 2. Re-grant UPDATE uniquement sur les colonnes qu'un user peut légitimement
--    modifier sur sa propre ligne. La policy RLS de 0002 limite déjà la ligne à
--    id = auth.uid(). `anon` n'a aucun chemin légitime -> pas de re-grant.
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- 3. Défense en profondeur : même si un futur code path tournait en tant que
--    `authenticated`/`anon`, on bloque toute tentative de changer
--    role/organization_id.
--    IMPORTANT : la fonction est en SECURITY INVOKER (le défaut). Surtout PAS
--    SECURITY DEFINER : dans ce cas current_user vaudrait `postgres` (le
--    propriétaire) et la garde bloquerait aussi le client admin (service_role),
--    cassant le retrait de membre et l'acceptation d'invitation. En INVOKER,
--    current_user reflète le vrai rôle appelant. On cible une LISTE BLANCHE des
--    rôles navigateur : service_role (admin) et postgres (migrations/admin
--    manuel) passent sans entrave.
create or replace function public.guard_profiles_protected_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'role ne peut pas être modifié par cette voie';
    end if;
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organization_id ne peut pas être modifié par cette voie';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profiles_protected_columns_trg
  before update on public.profiles
  for each row execute function public.guard_profiles_protected_columns();
