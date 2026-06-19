/**
 * Agrégation des deals d'une organisation (J24bis)
 * ------------------------------------------------
 * Vue agrégée (pas de table `deals`) : on regroupe les appels analysés d'une org
 * en « deals » (un prospect = un groupe d'appels), et pour chacun on calcule sa
 * trajectoire d'engagement (momentum J23) + une alerte si décrochage (J24) + un
 * statut d'activité. Sert de source de vérité unique à la page liste
 * /dashboard/deals.
 *
 * Statut « actif / dormant » basé sur l'ACTIVITÉ (récence du dernier appel) —
 * marche partout, y compris sur données simulées. Le vrai « gagné/perdu » HubSpot
 * (dealstage) viendra en phase 2 (persister le stage à l'enrichissement), sans
 * casser cette structure.
 */

import { createClient as createAdminClient } from '@supabase/supabase-js'

import {
  computeDealMomentum,
  type DealCallPoint,
  type DealMomentum,
} from '@/lib/metrics/momentum'
import {
  buildAlertForDeal,
  type CoachingAlert,
} from '@/lib/metrics/coaching-alert'
import { buildDealPhaseContext } from '@/lib/metrics/phase-context'
import {
  computeForecastConfidence,
  type ForecastConfidence,
} from '@/lib/metrics/forecast-confidence'
import type { ConversationMetrics } from '@/lib/metrics/conversation'
import type { BehavioralSignals } from '@/lib/claude'
import { getCrmAdapter } from '@/lib/crm'
import { getOrgHygiene } from '@/lib/hygiene/store'
import type { HygieneGap } from '@/lib/hygiene/types'

export type DealStatus = 'gagné' | 'perdu' | 'actif' | 'dormant'

// Mappe une phase HubSpot (dealstage) vers un statut « fermé » (J25 phase 2).
// On ne reconnaît avec certitude que les stages des pipelines STANDARD HubSpot
// (closedwon / closedlost). Les pipelines personnalisés utilisent des IDs de
// stage propres au client → on ne devine pas, ils retombent sur l'activité
// (la cartographie complète du tunnel viendra en Semaine 4).
export function closedStatusFromStage(stage: string | null): DealStatus | null {
  if (!stage) return null
  const s = stage.toLowerCase()
  if (s === 'closedwon') return 'gagné'
  if (s === 'closedlost') return 'perdu'
  return null
}

export type DealSummary = {
  group_key: string
  contact_name: string | null
  company_name: string | null
  deal_name: string | null
  owner_id: string | null
  owner_name: string | null
  calls_count: number
  last_activity: string // ISO de l'appel le plus récent du deal
  status: DealStatus
  momentum: DealMomentum
  // Non null seulement si le deal décroche (trend = baisse).
  alert: CoachingAlert | null
  // Libellé de la phase HubSpot courante (J32), null si inconnu/non synchronisé.
  stage_label: string | null
  // Fiabilité du forecast (J33) : confiance déclarée (phase) vs engagement réel.
  forecast: ForecastConfidence
}

// Au-delà de ce délai sans appel, un deal est considéré « dormant ».
const DORMANT_AFTER_DAYS = 30
// Exporté pour que le moteur d'hygiène (J30) calcule le même statut actif/dormant.
export const DORMANT_AFTER_MS = DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000

// L'embed analyses (1-to-1) peut renvoyer objet ou tableau selon le client.
type AnalysisRel = {
  conversation_metrics: ConversationMetrics | null
  behavioral_signals: BehavioralSignals | null
} | null

type CallRow = {
  id: string
  user_id: string | null
  callee_number: string | null
  contact_name: string | null
  company_name: string | null
  deal_name: string | null
  deal_id: string | null
  deal_stage: string | null
  started_at: string | null
  created_at: string
  analyses: AnalysisRel | AnalysisRel[]
}

function pickAnalysis(rel: AnalysisRel | AnalysisRel[]): AnalysisRel {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

// Clé de regroupement « deal » : identique à la liste d'appels et à la page deal.
function groupKeyOf(row: CallRow): string | null {
  if (row.deal_id) return `deal:${row.deal_id}`
  if (row.callee_number) return `phone:${row.callee_number}`
  return null
}

// Accumulateur interne mutable pendant le regroupement.
type Acc = {
  group_key: string
  contact_name: string | null
  company_name: string | null
  deal_name: string | null
  owner_id: string | null
  owner_name: string | null
  deal_stage: string | null // phase HubSpot du dernier appel rencontré
  points: DealCallPoint[]
  last_activity: number // ms, max rencontré
}

/**
 * Charge et agrège tous les deals d'une org. Utilise l'admin client (bypass RLS)
 * pour qu'un manager voie les deals de TOUTE l'équipe, avec filtre explicite
 * `organization_id` en défense en profondeur.
 */
export async function aggregateOrgDeals(orgId: string): Promise<DealSummary[]> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )

  // Profils de l'org → noms des commerciaux (propriétaires de deals).
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('organization_id', orgId)
  const memberName = new Map<string, string>(
    (profiles ?? []).map((p) => [
      p.id as string,
      ((p.full_name as string | null)?.trim() || (p.email as string)) ?? '',
    ]),
  )

  // Appels analysés + carte du tunnel (J27) + cache d'hygiène (J30) en parallèle.
  // Le tunnel et l'hygiène nourrissent le contexte phase de l'alerte (J32).
  const crm = await getCrmAdapter(orgId)
  const [{ data: callsData }, { pipelines }, hygieneReports] =
    await Promise.all([
      admin
        .from('calls')
        .select(
          `id, user_id, callee_number, contact_name, company_name, deal_name, deal_id, deal_stage, started_at, created_at,
           analyses ( conversation_metrics, behavioral_signals )`,
        )
        .eq('organization_id', orgId)
        .eq('status', 'analyzed')
        .order('created_at', { ascending: true }),
      crm.getStoredPipelines(),
      getOrgHygiene(orgId),
    ])

  // Écarts d'hygiène indexés par deal → contexte phase de l'alerte (J32).
  const gapsByKey = new Map<string, HygieneGap[]>()
  for (const r of hygieneReports) {
    if (r.gaps.length > 0) gapsByKey.set(r.group_key, r.gaps)
  }

  const accs = new Map<string, Acc>()
  for (const row of (callsData ?? []) as CallRow[]) {
    const key = groupKeyOf(row)
    if (!key) continue
    const a = pickAnalysis(row.analyses)
    const dateIso = row.started_at ?? row.created_at
    const point: DealCallPoint = {
      call_id: row.id,
      date: dateIso,
      conversation_metrics: a?.conversation_metrics ?? null,
      behavioral_signals: a?.behavioral_signals ?? null,
    }
    const ts = Date.parse(dateIso) || 0

    const existing = accs.get(key)
    if (existing) {
      existing.points.push(point)
      existing.last_activity = Math.max(existing.last_activity, ts)
      // Le « propriétaire » = commercial du dernier appel (rows triées asc).
      if (row.user_id) {
        existing.owner_id = row.user_id
        existing.owner_name = memberName.get(row.user_id) ?? null
      }
      // Identité = dernière valeur non nulle rencontrée.
      existing.contact_name = row.contact_name ?? existing.contact_name
      existing.company_name = row.company_name ?? existing.company_name
      existing.deal_name = row.deal_name ?? existing.deal_name
      // Phase HubSpot = celle du dernier appel (rows triées asc → la dernière gagne).
      existing.deal_stage = row.deal_stage ?? existing.deal_stage
    } else {
      accs.set(key, {
        group_key: key,
        contact_name: row.contact_name,
        company_name: row.company_name,
        deal_name: row.deal_name,
        owner_id: row.user_id,
        owner_name: row.user_id ? (memberName.get(row.user_id) ?? null) : null,
        deal_stage: row.deal_stage,
        points: [point],
        last_activity: ts,
      })
    }
  }

  const nowMs = Date.now()
  const deals: DealSummary[] = [...accs.values()].map((acc) => {
    const momentum = computeDealMomentum(acc.points)

    // Contexte phase (J32) : libellé + avancement (tunnel) + écarts d'hygiène +
    // inactivité. null si la phase n'est pas reconnue dans le tunnel synchronisé.
    const daysInactive = (nowMs - acc.last_activity) / (24 * 60 * 60 * 1000)
    const phase = buildDealPhaseContext({
      stageId: acc.deal_stage,
      pipelines,
      gaps: gapsByKey.get(acc.group_key) ?? [],
      daysInactive,
    })

    const alert = buildAlertForDeal(
      {
        group_key: acc.group_key,
        contact_name: acc.contact_name,
        company_name: acc.company_name,
        deal_name: acc.deal_name,
        owner_name: acc.owner_name,
        calls_count: acc.points.length,
      },
      momentum,
      phase,
    )

    // Fiabilité du forecast (J33) : confiance déclarée (phase) vs engagement réel.
    const forecast = computeForecastConfidence({
      advancement: phase?.advancement ?? null,
      isOpen: phase?.is_open ?? false,
      lastEngagement: momentum.last_engagement,
      declining: alert != null,
      unmetCriteria: (phase?.unmet_criteria.length ?? 0) > 0,
      stageMismatch: phase?.stage_mismatch ?? false,
    })
    // Statut : la phase HubSpot « fermée » (gagné/perdu) prime quand on la
    // connaît ; sinon repli sur l'activité (actif/dormant). Les deals simulés et
    // sans HubSpot n'ont pas de phase → comportement inchangé.
    const closed = closedStatusFromStage(acc.deal_stage)
    const status: DealStatus =
      closed ??
      (nowMs - acc.last_activity <= DORMANT_AFTER_MS ? 'actif' : 'dormant')

    return {
      group_key: acc.group_key,
      contact_name: acc.contact_name,
      company_name: acc.company_name,
      deal_name: acc.deal_name,
      owner_id: acc.owner_id,
      owner_name: acc.owner_name,
      calls_count: acc.points.length,
      last_activity: new Date(acc.last_activity).toISOString(),
      status,
      momentum,
      alert,
      stage_label: phase?.stage_label ?? null,
      forecast,
    }
  })

  return deals
}
