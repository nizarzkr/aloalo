// ============================================================================
// lib/hygiene/store.ts — Lecture du cache d'hygiène (J30, extrait au J32)
// ============================================================================
// Les LECTURES du cache `deal_hygiene` vivaient dans compute.ts. On les isole ici
// pour casser un cycle d'imports : `lib/deals/aggregate.ts` a besoin de lire
// l'hygiène (J32, alerte consciente des phases) mais `compute.ts` importe déjà
// `aggregate.ts` (closedStatusFromStage / DORMANT_AFTER_MS). Ce module ne dépend
// que de l'admin client + des types → importable des deux côtés sans boucle.
//
// compute.ts ré-exporte ces deux fonctions pour ne rien casser côté appelants.
// ============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'

import type { HygieneGap, HygieneReport } from '@/lib/hygiene/types'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

/** Tous les rapports d'hygiène d'une org (liste deals / accueil / alerte phase). */
export async function getOrgHygiene(orgId: string): Promise<HygieneReport[]> {
  const { data } = await admin()
    .from('deal_hygiene')
    .select(
      'group_key, stage_id, gaps, calls_signature, criteria_fingerprint, cost_eur, computed_at',
    )
    .eq('organization_id', orgId)

  return (data ?? []).map((r) => ({
    group_key: r.group_key as string,
    stage_id: (r.stage_id as string | null) ?? null,
    gaps: (r.gaps as HygieneGap[]) ?? [],
    calls_signature: (r.calls_signature as string | null) ?? '',
    criteria_fingerprint: (r.criteria_fingerprint as string | null) ?? '',
    cost_eur: (r.cost_eur as number | null) ?? null,
    computed_at: r.computed_at as string,
  }))
}

/** Rapport d'hygiène d'un deal précis (page trajectoire). */
export async function getDealHygiene(
  orgId: string,
  groupKey: string,
): Promise<HygieneReport | null> {
  const { data } = await admin()
    .from('deal_hygiene')
    .select(
      'group_key, stage_id, gaps, calls_signature, criteria_fingerprint, cost_eur, computed_at',
    )
    .eq('organization_id', orgId)
    .eq('group_key', groupKey)
    .maybeSingle()

  if (!data) return null
  return {
    group_key: data.group_key as string,
    stage_id: (data.stage_id as string | null) ?? null,
    gaps: (data.gaps as HygieneGap[]) ?? [],
    calls_signature: (data.calls_signature as string | null) ?? '',
    criteria_fingerprint: (data.criteria_fingerprint as string | null) ?? '',
    cost_eur: (data.cost_eur as number | null) ?? null,
    computed_at: data.computed_at as string,
  }
}
