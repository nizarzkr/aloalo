-- ============================================================================
-- Aloalo — Migration 0024 : Tâches d'alerte coaching poussées dans HubSpot
-- Date  : 2026-06-17
-- J-day : J26 (Semaine 4) — « L'alerte qui AGIT » (patch agentic #2)
-- ============================================================================
-- Contexte : une « Alerte Coaching » (deal qui décroche, J24) devient
-- ACTIONNABLE en 1 clic → un bouton crée la tâche de suivi correspondante dans
-- HubSpot (réutilise lib/hubspot.createTask, déjà en prod depuis J17/J18).
--
-- Problème à résoudre : un « deal » est une VUE AGRÉGÉE (pas de table `deals` —
-- on regroupe les appels à la volée par clé `deal:<id>` | `phone:<num>`). Il
-- n'existe donc aucun endroit pour mémoriser « cette action a déjà été poussée ».
-- Cette table comble ce trou et satisfait les 2 garde-fous du brief :
--   - IDEMPOTENCE : contrainte d'unicité (org + clé de deal + type d'action) →
--     re-cliquer ne crée jamais une 2ᵉ tâche.
--   - TRAÇABILITÉ : on garde l'ID de la tâche HubSpot créée, le texte poussé,
--     qui a poussé et quand.
--
-- Sécurité (cohérent avec le reste du repo) : RLS activée + forcée. L'utilisateur
-- ne fait que LIRE (pour afficher « Déjà poussé ✓ ») ; l'écriture passe par le
-- serveur (secret key, bypass RLS) — comme calls/analyses/usage_logs.
-- ============================================================================

create table if not exists public.deal_pushed_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Clé de regroupement du deal (identique partout : `deal:<hsId>` | `phone:<num>`).
  group_key text not null,
  -- Type d'action poussée. Un seul pour l'instant ; champ extensible (futurs
  -- patchs agentic : maj de phase, création de note, etc.).
  action_type text not null default 'coaching_task'
    check (action_type in ('coaching_task')),
  -- Cible HubSpot réellement utilisée (deal en priorité, sinon contact).
  hubspot_object_type text check (hubspot_object_type in ('deal', 'contact')),
  hubspot_object_id text,
  -- ID de la tâche HubSpot créée (la trace de l'effet).
  hubspot_task_id text,
  -- Texte du brief 1:1 poussé (pour audit / réaffichage).
  action_text text,
  -- Qui a déclenché l'action (set null si le compte est supprimé).
  pushed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- IDEMPOTENCE : une seule action d'un type donné par deal et par org.
  unique (organization_id, group_key, action_type)
);

comment on table public.deal_pushed_actions is
  'J26 — actions d''alerte coaching poussées dans HubSpot (idempotence + traçabilité). Un « deal » étant une vue agrégée, cette table est l''unique mémoire de « déjà poussé ».';

-- Lecture rapide de l'état « déjà poussé » pour une org (page liste + trajectoire).
create index if not exists deal_pushed_actions_org_idx
  on public.deal_pushed_actions (organization_id);

-- RLS : activée + forcée (defense-in-depth, cf. 0022). ----------------------
alter table public.deal_pushed_actions enable row level security;
alter table public.deal_pushed_actions force row level security;

-- SELECT scopé à l'org du JWT (helper SECURITY DEFINER de 0002, anti-récursion).
do $$ begin
  create policy "deal_pushed_actions_select_same_org"
    on public.deal_pushed_actions
    for select
    using (organization_id = public.user_organization_id());
exception when duplicate_object then null;
end $$;

-- Aucune policy INSERT/UPDATE/DELETE : seules les écritures serveur (secret key,
-- service_role, BYPASSRLS) peuvent insérer. On révoque explicitement l'écriture
-- au rôle authenticated (rend la règle infalsifiable, idempotent).
revoke insert, update, delete on public.deal_pushed_actions from authenticated;
