// ============================================================================
// lib/coaching/one-on-one.ts — Préparation des 1:1 (J35, axe Coacher)
// ============================================================================
// Génère un briefing de 1:1 par commercial, sur une PÉRIODE choisie par le
// manager, et le STOCKE (table coaching_sessions, migration 0030) pour comparer
// dans le temps (« depuis le dernier 1:1 ») et garder l'historique.
//
// Pattern calqué sur lib/exit-criteria.ts (J28) : admin client → distillation
// d'artefacts DÉJÀ analysés (zéro re-transcription, coût Haiku borné) → 1 passe
// IA (lib/claude.synthesizeOneOnOne) → store + log usage_logs.
//
// Ton garanti par le prompt IA (bienveillance). Agrégats déterministes via
// summarizeDimensions ; deals du rep via aggregateOrgDeals (filtré owner_id).
//
// Sécurité : table RLS server-only → toute lecture/écriture passe par le client
// admin ici ; le gating de rôle (owner/manager) est fait dans les server actions.
// ============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'

import {
  ANALYSIS_MODEL,
  estimateCostEur,
  synthesizeOneOnOne,
  type CoachingAdvice,
  type DimensionKey,
  type OneOnOneDimensionStat,
} from '@/lib/claude'
import { aggregateOrgDeals } from '@/lib/deals/aggregate'
import {
  aggregateDimensionStats,
  summarizeDimensions,
} from '@/lib/metrics/dimensions-summary'
import type { AiProfileData } from '@/lib/validations'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

// --- Périodes ----------------------------------------------------------------
// Chaque période = une INTENTION de management (affichée pour guider le choix).
export type PeriodType = 'week' | 'two_weeks' | 'month' | 'quarter' | 'year'

export const PERIODS: {
  id: PeriodType
  label: string
  intent: string
  days: number
}[] = [
  { id: 'week', label: 'Cette semaine', intent: 'Suivi rapproché — idéal pour un commercial qui démarre', days: 7 },
  { id: 'two_weeks', label: 'Ces 2 semaines', intent: 'Point sur les dossiers en cours', days: 14 },
  { id: 'month', label: 'Ce mois', intent: 'Progression mensuelle', days: 30 },
  { id: 'quarter', label: 'Ce trimestre', intent: 'Cycles de vente longs / bilan', days: 90 },
  { id: 'year', label: 'Cette année', intent: "Bilan et évolution dans la durée", days: 365 },
]

export function periodMeta(periodType: PeriodType) {
  return PERIODS.find((p) => p.id === periodType) ?? PERIODS[2]
}

// Fenêtre courante + fenêtre précédente équivalente (pour la comparaison).
export function computePeriod(periodType: PeriodType, now = new Date()) {
  const days = periodMeta(periodType).days
  const ms = days * 24 * 60 * 60 * 1000
  const end = now
  const start = new Date(now.getTime() - ms)
  const prevEnd = start
  const prevStart = new Date(start.getTime() - ms)
  return { start, end, prevStart, prevEnd }
}

// --- Libellés FR des dimensions ---------------------------------------------
const DIMENSION_LABELS: Record<DimensionKey, string> = {
  discovery: 'Découverte',
  qualification: 'Qualification',
  objection_handling: 'Traitement des objections',
  closing: 'Closing',
  next_step: 'Prochaine étape',
}

// --- Forme du snapshot stocké (jsonb) ---------------------------------------
export type OneOnOneDealRef = {
  group_key: string
  title: string
  severity: string
  action: string
}

export type OneOnOneSnapshot = {
  empty: boolean // true si aucun appel sur la période → pas d'IA
  callCount: number
  avgValidated: number | null
  prevAvgValidated: number | null
  dimensions: OneOnOneDimensionStat[]
  deals: OneOnOneDealRef[]
  // Continuité : le 1:1 précédent (date + axe travaillé), null si premier.
  sinceLast: { date: string; focusAxis: string } | null
  // Brief IA (null si empty).
  brief: {
    wins: string[]
    focus: { axis_label: string; why: string; suggestion: string }
    encouragement: string
  } | null
}

export type CoachingSession = {
  id: string
  rep_user_id: string
  period_type: PeriodType
  period_start: string
  period_end: string
  snapshot: OneOnOneSnapshot
  manager_notes: string
  created_at: string
}

// Normalise l'embed FK analyses (objet ou tableau selon le client).
function analysisOf(rel: unknown) {
  return (Array.isArray(rel) ? rel[0] : rel) as
    | { dimensions: unknown; coaching_advice: unknown }
    | undefined
}

// --- Lecture -----------------------------------------------------------------

/** Historique récent des 1:1 d'un commercial (le plus récent d'abord). */
export async function getRepSessions(
  orgId: string,
  repId: string,
  limit = 10,
): Promise<CoachingSession[]> {
  const { data } = await admin()
    .from('coaching_sessions')
    .select('id, rep_user_id, period_type, period_start, period_end, snapshot, manager_notes, created_at')
    .eq('organization_id', orgId)
    .eq('rep_user_id', repId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as CoachingSession[]
}

// --- Génération --------------------------------------------------------------

export type GenerateOneOnOneResult =
  | { ok: true; session: CoachingSession }
  | { ok: false; error: string }

/**
 * Génère un briefing de 1:1 pour `repId` sur `periodType`, le stocke, et le
 * renvoie. Pas d'appel IA si aucun appel analysé sur la période (snapshot vide
 * bienveillant). Sécurité : appelé uniquement depuis une server action gated.
 */
export async function generateOneOnOne(
  orgId: string,
  repId: string,
  periodType: PeriodType,
  managerId: string,
): Promise<GenerateOneOnOneResult> {
  if (!orgId || !repId) return { ok: false, error: 'Paramètres manquants.' }

  const supabase = admin()
  const { start, end, prevStart, prevEnd } = computePeriod(periodType)

  // Org (contexte IA) + identité du commercial.
  const [{ data: org }, { data: rep }] = await Promise.all([
    supabase.from('organizations').select('ai_profile').eq('id', orgId).maybeSingle(),
    supabase.from('profiles').select('full_name, email').eq('id', repId).eq('organization_id', orgId).maybeSingle(),
  ])
  if (!rep) return { ok: false, error: 'Commercial introuvable.' }
  const repName = (rep.full_name || '').trim() || rep.email || 'ce commercial'
  const aiProfile = (org?.ai_profile as AiProfileData | null) ?? null

  // Appels analysés du rep entre prevStart et end (on splite ensuite par fenêtre).
  const { data: callRows } = await supabase
    .from('calls')
    .select('created_at, analyses ( dimensions, coaching_advice )')
    .eq('organization_id', orgId)
    .eq('user_id', repId)
    .eq('status', 'analyzed')
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', end.toISOString())

  const rows = callRows ?? []
  const inWindow = (iso: string, from: Date, to: Date) => {
    const t = new Date(iso).getTime()
    return t >= from.getTime() && t <= to.getTime()
  }
  const current = rows.filter((r) => inWindow(r.created_at as string, start, end))
  const previous = rows.filter((r) => inWindow(r.created_at as string, prevStart, prevEnd))

  // Moyenne de dimensions validées (0-5) sur un ensemble d'appels.
  const avgValidatedOf = (set: typeof rows): number | null => {
    const vals = set
      .map((r) => summarizeDimensions(analysisOf(r.analyses)?.dimensions)?.validated)
      .filter((v): v is number => typeof v === 'number')
    if (vals.length === 0) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const callCount = current.length
  const avgValidated = avgValidatedOf(current)
  const prevAvgValidated = avgValidatedOf(previous)

  // Dernier 1:1 du rep (continuité « depuis le dernier 1:1 »).
  const [last] = await getRepSessions(orgId, repId, 1)
  const sinceLast =
    last && last.snapshot?.brief?.focus?.axis_label
      ? { date: last.created_at, focusAxis: last.snapshot.brief.focus.axis_label }
      : null

  // --- Cas « pas assez de données » : snapshot vide, aucun appel IA ---------
  if (callCount === 0) {
    const snapshot: OneOnOneSnapshot = {
      empty: true,
      callCount: 0,
      avgValidated: null,
      prevAvgValidated,
      dimensions: [],
      deals: [],
      sinceLast,
      brief: null,
    }
    return persist(supabase, { orgId, repId, managerId, periodType, start, end, snapshot, costEur: null })
  }

  // Miss/partial rate par dimension sur la fenêtre courante (helper partagé J36).
  const dimStats = aggregateDimensionStats(
    current.map((r) => analysisOf(r.analyses)?.dimensions),
  )
  const dimensions: OneOnOneDimensionStat[] = Object.values(dimStats)
    .filter((s) => s.total > 0)
    .map((s) => ({
      key: s.key,
      label: DIMENSION_LABELS[s.key],
      missedRate: s.missed / s.total,
      partialRate: s.partial / s.total,
    }))

  // Thèmes de coaching récurrents (high/medium d'abord, dédoublonnés, top 3).
  const advices: CoachingAdvice[] = current.flatMap((r) => {
    const a = analysisOf(r.analyses)?.coaching_advice
    return Array.isArray(a) ? (a as CoachingAdvice[]) : []
  })
  const rank = { high: 0, medium: 1, low: 2 } as const
  const recurringCoaching = Array.from(
    new Set(
      advices
        .filter((a) => typeof a?.advice === 'string' && a.advice.trim())
        .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3))
        .map((a) => a.advice.trim()),
    ),
  ).slice(0, 3)

  // Deals à suivre du rep : ceux qui décrochent (alerte), top 3 par sévérité.
  let deals: OneOnOneDealRef[] = []
  try {
    const allDeals = await aggregateOrgDeals(orgId)
    const sevRank = { haute: 0, moyenne: 1 } as Record<string, number>
    deals = allDeals
      .filter((d) => d.owner_id === repId && d.alert !== null)
      .sort((a, b) => (sevRank[a.alert!.severity] ?? 9) - (sevRank[b.alert!.severity] ?? 9))
      .slice(0, 3)
      .map((d) => ({
        group_key: d.group_key,
        title: d.alert!.title,
        severity: d.alert!.severity,
        action: d.alert!.action,
      }))
  } catch (e) {
    // Les deals sont un bonus : une panne d'agrégation ne casse pas le 1:1.
    console.error('[one-on-one] agrégation deals échouée', (e as Error).message)
  }

  // --- Passe IA (briefing bienveillant) -------------------------------------
  let result
  try {
    result = await synthesizeOneOnOne(
      {
        repName,
        periodLabel: periodMeta(periodType).label.toLowerCase(),
        callCount,
        avgValidated,
        prevAvgValidated,
        dimensions,
        recurringCoaching,
        previousFocusAxis: sinceLast?.focusAxis ?? null,
      },
      aiProfile,
    )
  } catch (e) {
    console.error('[one-on-one] synthèse IA échouée', (e as Error).message)
    return { ok: false, error: 'La génération du brief a échoué. Réessayez dans un instant.' }
  }

  const snapshot: OneOnOneSnapshot = {
    empty: false,
    callCount,
    avgValidated,
    prevAvgValidated,
    dimensions,
    deals,
    sinceLast,
    brief: result.brief,
  }
  const costEur = estimateCostEur(result.usage.input_tokens, result.usage.output_tokens)

  return persist(supabase, {
    orgId,
    repId,
    managerId,
    periodType,
    start,
    end,
    snapshot,
    costEur,
    usage: result.usage,
  })
}

// --- Persistance commune -----------------------------------------------------

async function persist(
  supabase: ReturnType<typeof admin>,
  args: {
    orgId: string
    repId: string
    managerId: string
    periodType: PeriodType
    start: Date
    end: Date
    snapshot: OneOnOneSnapshot
    costEur: number | null
    usage?: { input_tokens: number; output_tokens: number }
  },
): Promise<GenerateOneOnOneResult> {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .insert({
      organization_id: args.orgId,
      rep_user_id: args.repId,
      created_by: args.managerId,
      period_type: args.periodType,
      period_start: args.start.toISOString(),
      period_end: args.end.toISOString(),
      snapshot: args.snapshot,
      cost_eur: args.costEur,
    })
    .select('id, rep_user_id, period_type, period_start, period_end, snapshot, manager_notes, created_at')
    .single()

  if (error || !data) {
    console.error('[one-on-one] persistance échouée', error?.message)
    return { ok: false, error: 'Enregistrement impossible. Réessayez.' }
  }

  // Log de coût (uniquement si appel IA réel).
  if (args.costEur != null && args.usage) {
    await supabase.from('usage_logs').insert({
      organization_id: args.orgId,
      service: 'anthropic',
      operation: 'one_on_one',
      units: args.usage.input_tokens + args.usage.output_tokens,
      cost_eur: args.costEur,
      metadata: {
        model: ANALYSIS_MODEL,
        input_tokens: args.usage.input_tokens,
        output_tokens: args.usage.output_tokens,
        rep_user_id: args.repId,
        period_type: args.periodType,
      },
    })
  }

  return { ok: true, session: data as CoachingSession }
}

/** Met à jour les notes manuelles d'un 1:1 (server action gated). */
export async function saveSessionNotes(
  orgId: string,
  sessionId: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!orgId || !sessionId) return { ok: false, error: 'Paramètres manquants.' }
  const { error } = await admin()
    .from('coaching_sessions')
    .update({ manager_notes: notes })
    .eq('id', sessionId)
    .eq('organization_id', orgId)
  if (error) {
    console.error('[one-on-one] maj notes échouée', error.message)
    return { ok: false, error: 'Enregistrement impossible. Réessayez.' }
  }
  return { ok: true }
}
