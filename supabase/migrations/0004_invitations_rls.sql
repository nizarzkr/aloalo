-- ============================================================================
-- Aloalo — Migration 0004 : RLS invitations (J8 étape 2)
-- Date  : 2026-05-06
-- ============================================================================
-- Active les policies INSERT/UPDATE manquantes sur public.invitations.
-- La policy SELECT existe déjà depuis 0002 (owners + managers de l'org).
--
-- Note schéma : token reste TEXT (default hex 32-char) tel que défini en 0001 ;
-- pas de migration UUID, le brief J8 acceptait TEXT.
-- Les rôles d'invitation suivent la contrainte historique : 'manager' | 'sales'
-- (un owner ne se duplique pas).
-- ============================================================================


-- Garde-fou : si une exécution antérieure a oublié la colonne token, on la
-- rajoute en TEXT (cohérent avec 0001). Pas de UUID pour ne pas casser les
-- valeurs existantes.
alter table public.invitations
  add column if not exists token text unique
  default replace(gen_random_uuid()::text, '-', '');


-- ============================================================================
-- INSERT — seul un owner de l'org peut créer une invitation pour SON org
-- ============================================================================
-- En pratique, notre route /api/invitations passe par la secret key et bypass
-- la RLS, mais on durcit quand même la policy pour défense en profondeur.
drop policy if exists "Owners can create invitations" on public.invitations;
create policy "Owners can create invitations"
  on public.invitations for insert
  to authenticated
  with check (
    organization_id = public.user_organization_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );


-- ============================================================================
-- UPDATE — pas de policy authenticated : seul le serveur (secret key) écrit.
-- ============================================================================
-- L'acceptation d'une invitation se fait via /api/invitations/[token]/accept
-- avec le client admin → bypass RLS. Aucune policy UPDATE pour les users.
-- Idem DELETE : géré côté serveur si besoin (révocation, expiration).
