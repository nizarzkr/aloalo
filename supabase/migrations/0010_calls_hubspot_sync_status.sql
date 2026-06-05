-- ============================================================================
-- Aloalo — Migration 0010 : calls.hubspot_sync_status (J17)
-- Date  : 2026-06-05
-- ============================================================================
-- Automation post-analyse : après chaque analyse IA, si l'org a connecté
-- HubSpot, on pousse sur la fiche contact (1) une note de synthèse, (2) un
-- email de suivi en brouillon (modèle de vente choisi + rempli par Claude),
-- (3) une tâche de follow-up. On garde le résultat de cette synchro ici pour
-- l'afficher sur /dashboard/calls/[id] sans retaper HubSpot.
--
-- Forme du jsonb (tous les champs optionnels — dépend de ce qui a réussi) :
--   {
--     "status": "synced" | "no_contact" | "skipped" | "error",
--     "synced_at": "2026-06-05T10:00:00.000Z",
--     "contact_id": "12345",                  -- contact HubSpot matché (si trouvé)
--     "note_id": "67890",                      -- note créée (si OK)
--     "task_id": "111",                        -- tâche créée (si OK)
--     "email_id": "222",                       -- email brouillon HubSpot (si OK)
--     "email_pushed": true,                    -- le brouillon a-t-il atterri dans HubSpot
--     "template_name": "Relance après démo",   -- modèle choisi par Claude
--     "email_subject": "...",                  -- objet proposé (toujours stocké)
--     "email_body": "..."                      -- corps proposé (toujours stocké,
--                                              --   visible côté Aloalo même si
--                                              --   le push HubSpot échoue)
--   }
--
-- On stocke TOUJOURS l'email proposé (subject/body) ici, indépendamment du
-- succès du push HubSpot : la valeur démo (« l'IA a choisi + rempli VOTRE
-- modèle ») reste visible dans Aloalo même si le brouillon HubSpot échoue.
--
-- `add column if not exists` rend la migration idempotente.
-- ============================================================================

alter table public.calls
  add column if not exists hubspot_sync_status jsonb;

comment on column public.calls.hubspot_sync_status is
  'Résultat de la synchro HubSpot post-analyse (J17) : note/email brouillon/tâche poussés sur la fiche contact + email de suivi proposé par Claude. Écrit côté serveur uniquement (after() dans /api/analyze). Voir migration 0010 pour la forme du jsonb.';
