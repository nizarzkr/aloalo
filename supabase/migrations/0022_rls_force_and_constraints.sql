-- ============================================================================
-- Aloalo — Migration 0022 : Durcissement RLS + contraintes data
-- Date  : 2026-06-10
-- Issue : #26 (audit pré-PoC du 2026-06-08)
-- ============================================================================
-- Defense-in-depth (AUCUN exploit actif aujourd'hui — l'isolation RLS marche) :
--   1. FORCE RLS sur les 6 tables → le drapeau relforcerowsecurity passe à true.
--      But : si un jour le rôle propriétaire perd BYPASSRLS, ou qu'une nouvelle
--      fonction SECURITY DEFINER tourne dans un contexte non-bypass, les policies
--      s'appliquent quand même au lieu d'être silencieusement contournées.
--      NB : aujourd'hui `postgres` (propriétaire des tables/fonctions) a
--      BYPASSRLS, et `service_role` (secret key serveur) aussi → ni FORCE ni les
--      REVOKE ci-dessous ne cassent le pipeline. user_organization_id()
--      (SECURITY DEFINER, owner postgres) continue donc de bypasser la RLS :
--      pas de récursion sur la policy SELECT de profiles.
--   2. REVOKE écriture sur les tables alimentées UNIQUEMENT côté serveur
--      (calls/analyses/usage_logs) → rend explicite et infalsifiable la règle
--      « le serveur écrit (secret key), l'utilisateur ne fait que LIRE ».
--      Jusqu'ici cette règle reposait sur la simple ABSENCE de policy d'écriture.
--   3. CHECK >= 0 sur coûts/unités (anti bug de signe en facturation) +
--      updated_at sur analyses (une analyse est ré-exécutable → horodatage maj).
-- ============================================================================


-- 1) FORCE ROW LEVEL SECURITY sur les 6 tables -------------------------------
--    Idempotent : ré-appliquer FORCE sur une table déjà forcée ne lève rien.
alter table public.organizations force row level security;
alter table public.profiles      force row level security;
alter table public.calls         force row level security;
alter table public.analyses      force row level security;
alter table public.usage_logs    force row level security;
alter table public.invitations   force row level security;


-- 2) Baseline de privilèges : aucune écriture par le rôle `authenticated` sur
--    les tables alimentées uniquement côté serveur. Le SELECT reste autorisé
--    (les policies de 0002 gèrent le scoping par org). `service_role` (secret
--    key serveur, BYPASSRLS + grants propres) n'est PAS affecté → pipeline OK.
--    REVOKE est idempotent (révoquer un privilège déjà absent ne lève rien).
revoke insert, update, delete on public.calls      from authenticated;
revoke insert, update, delete on public.analyses   from authenticated;
revoke insert, update, delete on public.usage_logs from authenticated;


-- 3a) Contraintes non-négatives sur coûts / unités ---------------------------
--     Postgres ne supporte pas `add constraint if not exists` pour un CHECK →
--     on enveloppe chaque ajout dans un bloc qui avale le duplicate_object,
--     ce qui rend la migration rejouable (cohérent avec le style du repo).
do $$ begin
  alter table public.analyses
    add constraint analyses_cost_eur_non_negative
    check (cost_eur is null or cost_eur >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.usage_logs
    add constraint usage_logs_cost_eur_non_negative
    check (cost_eur is null or cost_eur >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.usage_logs
    add constraint usage_logs_units_non_negative
    check (units is null or units >= 0);
exception when duplicate_object then null;
end $$;


-- 3b) updated_at sur analyses (analyse ré-exécutable → horodatage de maj) -----
--     Réutilise la fonction générique public.handle_updated_at() (migration 0001).
alter table public.analyses
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at_analyses on public.analyses;
create trigger set_updated_at_analyses
  before update on public.analyses
  for each row execute function public.handle_updated_at();
