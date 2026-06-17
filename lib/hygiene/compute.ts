// ============================================================================
// lib/hygiene/compute.ts — Calcul + cache + persistance de l'hygiène (J30)
// ============================================================================
// Orchestre le moteur de détection pour UN deal :
//   1. charge les appels du deal + sa dernière analyse ;
//   2. calcule les signatures de cache (nouvel appel / critères modifiés) ;
//   3. court-circuite si rien n'a bougé (zéro coût IA) ;
//   4. règles déterministes (gratuit) + 1 passe IA légère (si phase à critères) ;
//   5. upsert dans deal_hygiene.
//
// Admin client (bypass RLS), hors `'use server'` → importable par la route
// d'analyse et, plus tard, par les Server Components de J31 (lecture seule).
// ============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'

import {
  ANALYSIS_MODEL,
  estimateCostEur,
  evaluateDealHygiene,
  type BehavioralSignals,
  type DimensionEval,
  type SuggestedTask,
} from '@/lib/claude'
import { closedStatusFromStage, DORMANT_AFTER_MS } from '@/lib/deals/aggregate'
import { getOrgExitCriteria, type ExitCriterion } from '@/lib/exit-criteria'
import { getOrgPipelines } from '@/lib/hubspot-pipelines'
import {
  deriveDeterministicGaps,
  gapsFromAiEval,
  prioritizeGaps,
} from '@/lib/hygiene/rules'
import type { HygieneGap, HygieneReport } from '@/lib/hygiene/types'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

// Empreinte des critères d'une phase : change si un id ou un libellé change →
// invalide le cache (rend trivial le « rafraîchir l'hygiène » de J31).
function criteriaFingerprint(criteria: ExitCriterion[]): string {
  return criteria.map((c) => `${c.id}:${c.label}`).join('|')
}

type AnalysisRel = {
  summary: string | null
  dimensions: DimensionEval[] | null
  behavioral_signals: BehavioralSignals | null
  suggested_tasks: SuggestedTask[] | null
} | null

function pickAnalysis(rel: AnalysisRel | AnalysisRel[]): AnalysisRel {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

type CallRow = {
  id: string
  callee_number: string | null
  deal_id: string | null
  deal_stage: string | null
  started_at: string | null
  created_at: string
  analyses: AnalysisRel | AnalysisRel[]
}

export type ComputeOptions = {
  // Force le recalcul même si les signatures sont inchangées (J31 : critères
  // modifiés à la main, demande explicite).
  force?: boolean
}

/**
 * Calcule (ou relit depuis le cache) le rapport d'hygiène d'un deal et le
 * persiste dans `deal_hygiene`. Renvoie le rapport, ou null si le deal n'a aucun
 * appel analysé (rien à évaluer).
 */
export async function computeDealHygiene(
  orgId: string,
  groupKey: string,
  opts: ComputeOptions = {},
): Promise<HygieneReport | null> {
  const supabase = admin()

  // 1. Appels du deal (mêmes clés de regroupement que lib/deals/aggregate).
  let query = supabase
    .from('calls')
    .select(
      `id, callee_number, deal_id, deal_stage, started_at, created_at,
       analyses ( summary, dimensions, behavioral_signals, suggested_tasks )`,
    )
    .eq('organization_id', orgId)
    .eq('status', 'analyzed')
    .order('created_at', { ascending: true })

  if (groupKey.startsWith('deal:')) {
    query = query.eq('deal_id', groupKey.slice(5))
  } else if (groupKey.startsWith('phone:')) {
    // Groupe « téléphone » = appels sans deal HubSpot (cf. groupKeyOf).
    query = query.eq('callee_number', groupKey.slice(6)).is('deal_id', null)
  } else {
    return null
  }

  const { data: callsData } = await query
  const calls = (callsData ?? []) as CallRow[]
  if (calls.length === 0) return null

  const latest = calls[calls.length - 1]
  // Phase courante = dernière valeur non nulle (l'enrichissement peut l'avoir
  // posée sur un appel plus récent).
  let dealStage: string | null = null
  let lastActivityMs = 0
  for (const c of calls) {
    if (c.deal_stage) dealStage = c.deal_stage
    const ts = Date.parse(c.started_at ?? c.created_at) || 0
    if (ts > lastActivityMs) lastActivityMs = ts
  }

  const hasDealId = groupKey.startsWith('deal:') || calls.some((c) => c.deal_id)

  // 2. Carte du tunnel + critères de la phase courante.
  const [{ pipelines }, criteriaMap] = await Promise.all([
    getOrgPipelines(orgId),
    getOrgExitCriteria(orgId),
  ])

  // Phase reconnue dans le tunnel ? + libellé + phases ouvertes ordonnées +
  // si la phase courante est FERMÉE (flag isClosed du tunnel J27 — fiable même
  // sur les pipelines personnalisés, contrairement à closedStatusFromStage).
  let stageKnown = false
  let stageLabel = ''
  let stageIsClosed = false
  let orderedOpenStages: { stageId: string; stageLabel: string }[] = []
  for (const p of pipelines) {
    const found = p.stages.find((s) => s.id === dealStage)
    if (found) {
      stageKnown = true
      stageLabel = found.label
      stageIsClosed = found.isClosed
      orderedOpenStages = p.stages
        .filter((s) => !s.isClosed)
        .map((s) => ({ stageId: s.id, stageLabel: s.label }))
      break
    }
  }

  // 3. Statut du deal. `closed` (gagné/perdu) ne marche que sur les pipelines
  // STANDARD ; le flag isClosed du tunnel couvre les pipelines personnalisés.
  // `dealIsClosed` sert à neutraliser les règles « ouvertes » (dormant / next
  // step) et à ne pas dépenser d'IA sur un deal déjà fermé.
  const closed = closedStatusFromStage(dealStage)
  const dealIsClosed = closed !== null || stageIsClosed
  // Sentinel : pour un deal fermé custom (gagné/perdu indistinct), on passe
  // 'gagné' — non persisté, non affiché, sert juste à faire ignorer les règles
  // réservées aux deals actifs/dormants.
  const status = dealIsClosed
    ? (closed ?? 'gagné')
    : Date.now() - lastActivityMs <= DORMANT_AFTER_MS
      ? 'actif'
      : 'dormant'

  const criteria = dealStage ? (criteriaMap[dealStage]?.criteria ?? []) : []

  // 4. Signatures de cache.
  const callsSignature = `${calls.length}:${latest.id}`
  const critFingerprint = criteriaFingerprint(criteria)

  const { data: existing } = await supabase
    .from('deal_hygiene')
    .select('id, calls_signature, criteria_fingerprint, stage_id, gaps, cost_eur, computed_at')
    .eq('organization_id', orgId)
    .eq('group_key', groupKey)
    .maybeSingle()

  if (
    !opts.force &&
    existing &&
    existing.calls_signature === callsSignature &&
    existing.criteria_fingerprint === critFingerprint
  ) {
    // Rien n'a bougé → on relit le cache (aucun coût IA).
    return {
      group_key: groupKey,
      stage_id: (existing.stage_id as string | null) ?? null,
      gaps: (existing.gaps as HygieneGap[]) ?? [],
      calls_signature: callsSignature,
      criteria_fingerprint: critFingerprint,
      cost_eur: (existing.cost_eur as number | null) ?? null,
      computed_at: (existing.computed_at as string) ?? new Date().toISOString(),
    }
  }

  // 5. Règles déterministes (gratuit).
  const analysis = pickAnalysis(latest.analyses)
  const gaps: HygieneGap[] = deriveDeterministicGaps({
    hasDealId,
    stageKnown,
    status,
    latestSuggestedTasksCount: analysis?.suggested_tasks?.length ?? 0,
  })

  // 6. Passe IA — seulement si la phase courante (ouverte) a des critères de
  // sortie. Sinon, rien à évaluer sémantiquement → coût nul.
  let costEur: number | null = null
  if (!dealIsClosed && stageKnown && criteria.length > 0 && analysis) {
    try {
      const { evaluation, usage } = await evaluateDealHygiene({
        stageLabel,
        orderedOpenStages,
        criteria: criteria.map((c) => ({ id: c.id, label: c.label })),
        summary: analysis.summary,
        dimensions: analysis.dimensions,
        behavioralSignals: analysis.behavioral_signals,
        suggestedTasks: analysis.suggested_tasks,
      })
      gaps.push(...gapsFromAiEval(criteria, evaluation))

      costEur = estimateCostEur(usage.input_tokens, usage.output_tokens)
      await supabase.from('usage_logs').insert({
        organization_id: orgId,
        service: 'anthropic',
        operation: 'hygiene',
        units: usage.input_tokens + usage.output_tokens,
        cost_eur: costEur,
        metadata: {
          model: ANALYSIS_MODEL,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          group_key: groupKey,
          criteria_count: criteria.length,
        },
      })
    } catch (e) {
      // L'IA down ne doit pas priver le deal de ses écarts déterministes.
      console.error('[hygiene] évaluation IA échouée', (e as Error).message)
    }
  }

  const prioritized = prioritizeGaps(gaps)
  const computedAt = new Date().toISOString()

  // 7. Upsert (un rapport par deal et par org).
  const { error: upsertErr } = await supabase.from('deal_hygiene').upsert(
    {
      organization_id: orgId,
      group_key: groupKey,
      stage_id: dealStage,
      gaps: prioritized,
      calls_signature: callsSignature,
      criteria_fingerprint: critFingerprint,
      cost_eur: costEur,
      computed_at: computedAt,
    },
    { onConflict: 'organization_id,group_key' },
  )
  if (upsertErr) {
    console.error('[hygiene] persistance échouée', upsertErr.message)
  }

  return {
    group_key: groupKey,
    stage_id: dealStage,
    gaps: prioritized,
    calls_signature: callsSignature,
    criteria_fingerprint: critFingerprint,
    cost_eur: costEur,
    computed_at: computedAt,
  }
}

// --- Lecture (J31) ----------------------------------------------------------

/** Tous les rapports d'hygiène d'une org (futur écran manager). */
export async function getOrgHygiene(orgId: string): Promise<HygieneReport[]> {
  const { data } = await admin()
    .from('deal_hygiene')
    .select('group_key, stage_id, gaps, calls_signature, criteria_fingerprint, cost_eur, computed_at')
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

/** Rapport d'hygiène d'un deal précis (page trajectoire J31). */
export async function getDealHygiene(
  orgId: string,
  groupKey: string,
): Promise<HygieneReport | null> {
  const { data } = await admin()
    .from('deal_hygiene')
    .select('group_key, stage_id, gaps, calls_signature, criteria_fingerprint, cost_eur, computed_at')
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
