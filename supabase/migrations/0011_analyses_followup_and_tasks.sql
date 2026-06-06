-- 0011 — Refonte de l'automatisation post-appel (remplace l'email de suivi auto)
--
-- Contexte : l'idée « brouillon d'email rédigé par l'IA » est abandonnée
-- (HubSpot ne permet pas de vrai brouillon éditable via API, et les équipes
-- ont déjà leurs propres modèles d'email). On la remplace par deux sorties
-- contextuelles produites par l'analyse IA, spécifiques à CHAQUE appel :
--
--   followup_points : points concrets à intégrer dans l'email de suivi que
--     le commercial enverra lui-même (infos demandées/promises non fournies
--     pendant l'appel + engagements pris par le prospect). Array de strings.
--
--   suggested_tasks : tâches de suivi spécifiques à l'appel, datées
--     intelligemment d'après ce qui s'y est dit (ex. « prendre des nouvelles
--     suite à la réunion du prospect avec son manager » le lendemain de cette
--     réunion). Array d'objets { title, due_date (AAAA-MM-JJ), reason }.
--
-- Les deux sont remplis à l'insert dans /api/analyze (spread de l'objet
-- d'analyse). Default '[]' pour que les anciennes lignes restent valides.

alter table public.analyses
  add column if not exists followup_points jsonb not null default '[]'::jsonb,
  add column if not exists suggested_tasks jsonb not null default '[]'::jsonb;

comment on column public.analyses.followup_points is
  'Points à intégrer dans l''email de suivi (infos demandées/promises non fournies + engagements du prospect). Array de strings.';
comment on column public.analyses.suggested_tasks is
  'Tâches de suivi spécifiques à l''appel proposées par l''IA. Array d''objets {title, due_date (AAAA-MM-JJ), reason}.';
