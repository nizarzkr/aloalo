// ============================================================================
// lib/deals/pushed-actions.ts — Mémoire des actions poussées dans HubSpot (J26)
// ============================================================================
// Un « deal » est une vue agrégée (pas de table `deals`). La table
// `deal_pushed_actions` (migration 0024) est donc l'unique endroit qui retient
// qu'une alerte coaching a déjà été transformée en tâche HubSpot.
//
// Ce module expose la LECTURE (utilisée par les Server Components pour afficher
// « Déjà poussé ✓ » et désactiver le bouton). L'ÉCRITURE vit dans la Server
// Action `pushCoachingAction` (app/dashboard/deals/actions.ts).
//
// Lecture en admin client (bypass RLS) scopée explicitement sur l'org — même
// pattern que `aggregateOrgDeals`, pour qu'un manager voie l'état de toute
// l'équipe.
// ============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'

const COACHING_TASK = 'coaching_task'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Ensemble des clés de deal (group_key) pour lesquelles une tâche coaching a
 * déjà été poussée dans HubSpot, pour une org. Sert à la liste /dashboard/deals
 * (une seule requête, lookup O(1) par carte).
 */
export async function getPushedCoachingKeys(
  orgId: string,
): Promise<Set<string>> {
  const { data } = await admin()
    .from('deal_pushed_actions')
    .select('group_key')
    .eq('organization_id', orgId)
    .eq('action_type', COACHING_TASK)

  return new Set((data ?? []).map((r) => r.group_key as string))
}

/**
 * Indique si une tâche coaching a déjà été poussée pour UN deal précis (page
 * trajectoire, où on ne charge qu'un deal).
 */
export async function hasPushedCoachingAction(
  orgId: string,
  groupKey: string,
): Promise<boolean> {
  const { data } = await admin()
    .from('deal_pushed_actions')
    .select('id')
    .eq('organization_id', orgId)
    .eq('group_key', groupKey)
    .eq('action_type', COACHING_TASK)
    .maybeSingle()

  return Boolean(data)
}

// --- Corrections d'hygiène (J31) --------------------------------------------

// Clé composite « deal + type d'action » → l'UI sait, en O(1), si la correction
// d'un écart donné a déjà été poussée. Aligné avec hygieneActionType().
function compositeKey(groupKey: string, actionType: string): string {
  return `${groupKey}::${actionType}`
}

/**
 * Ensemble des corrections d'hygiène déjà poussées dans HubSpot pour une org,
 * sous forme de clés `${group_key}::${action_type}` (action_type = `hygiene:<gapType>`).
 * Sert aux surfaces J31 (liste deals, accueil, trajectoire) pour afficher
 * « Corrigé ✓ » par écart sans requête par carte.
 */
export async function getPushedHygieneActions(
  orgId: string,
): Promise<Set<string>> {
  const { data } = await admin()
    .from('deal_pushed_actions')
    .select('group_key, action_type')
    .eq('organization_id', orgId)
    .like('action_type', 'hygiene:%')

  return new Set(
    (data ?? []).map((r) =>
      compositeKey(r.group_key as string, r.action_type as string),
    ),
  )
}

// Exporté pour que l'UI compose la même clé que getPushedHygieneActions.
export { compositeKey as hygienePushedKey }
