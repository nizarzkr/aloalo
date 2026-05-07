-- ============================================================================
-- Aloalo — Migration 0005 : profils détachables (J8 retrait de membre)
-- Date  : 2026-05-06
-- ============================================================================
-- Permet de "retirer" un membre d'une org sans supprimer son compte auth :
--   - profiles.organization_id devient nullable
--   - on ajoute removed_at pour tracker la date du détachement (futur cron de
--     suppression définitive RGPD à J+90, prévu J11/J12)
--
-- Effet sur la RLS : la fonction user_organization_id() renverra NULL pour un
-- profil détaché, donc toutes les policies "= public.user_organization_id()"
-- retourneront FALSE → le membre détaché ne verra plus aucune donnée de
-- l'ancienne org. Comportement désiré.
-- ============================================================================

alter table public.profiles
  alter column organization_id drop not null;

alter table public.profiles
  add column if not exists removed_at timestamptz;

comment on column public.profiles.removed_at is
  'Date à laquelle le profil a été détaché de son org (retrait par owner). Le compte sera définitivement supprimé 90 jours plus tard par un cron RGPD.';
