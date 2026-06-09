-- ============================================================================
-- Aloalo — Migration 0017 : protège les credentials tiers de organizations
-- Date  : 2026-06-09
-- ============================================================================
-- Contexte (audit pré-PoC #5) : la policy RLS "Users can view their own
-- organization" (0002) + le GRANT SELECT par défaut de Supabase exposent TOUTES
-- les colonnes de l'org au rôle `authenticated`. Un membre `sales` peut donc
-- lire `ringover_api_key` / `hubspot_token` EN CLAIR depuis le navigateur.
--
-- On retire l'accès navigateur aux 3 colonnes sensibles. Seul le `service_role`
-- (clé secrète, bypass RLS) les lit encore — toutes les lectures applicatives
-- de ces colonnes passent désormais par le client admin (cf. issue #5).
--
-- ⚠️ Subtilité Postgres : les privilèges sont ADDITIFS. Un `REVOKE SELECT
-- (colonne)` est sans effet tant que le rôle garde un SELECT niveau TABLE
-- (c'est le cas ici, accordé par défaut par Supabase). Il faut donc d'abord
-- révoquer le SELECT niveau table, puis re-grant colonne par colonne sur les
-- seuls champs non sensibles.
-- ============================================================================

-- 1. Retire le SELECT niveau table (sinon le grant colonne ne restreint rien).
revoke select on public.organizations from authenticated;

-- 2. Re-grant SELECT uniquement sur les colonnes NON sensibles.
--    Liste alignée sur le schéma live au 2026-06-09 (15 colonnes au total ;
--    les 3 absentes — ringover_api_key, hubspot_token, hubspot_portal_id —
--    sont volontairement exclues). À tenir à jour si la table évolue.
grant select (
  id, name, slug,
  stripe_customer_id, stripe_subscription_id,
  subscription_status, subscription_plan, trial_ends_at,
  logo_url, ai_profile,
  created_at, updated_at
) on public.organizations to authenticated;

-- Note `anon` : il conserve son SELECT niveau table par défaut, mais aucune
-- policy RLS `to anon` n'existe sur organizations → il ne reçoit 0 ligne de
-- toute façon. On ne le touche pas (changement minimal).
