// ============================================================================
// lib/metrics/phase-context.ts — Contexte « phase du tunnel » d'un deal (J32)
// ============================================================================
// J32 rend l'Alerte Coaching (J24) CONSCIENTE DU TUNNEL. Ce module, PUR, assemble
// le « contexte phase » d'un deal à partir de données déjà chargées ailleurs :
//   - la carte du tunnel HubSpot (J27, getOrgPipelines) → libellé + avancement ;
//   - le cache d'hygiène (J30) → critères de sortie non remplis + phase ≠ réalité ;
//   - l'inactivité (jours depuis le dernier APPEL — on ne stocke pas la date
//     d'entrée en phase HubSpot, donc proxy assumé).
//
// `buildAlertForDeal` (coaching-alert.ts) consomme ce contexte pour moduler la
// sévérité, enrichir les raisons et proposer une action plus concrète. Aucune I/O
// ici → testable sans mock.
// ============================================================================

import type { CrmPipeline } from '@/lib/crm/types'
import type { HygieneGap } from '@/lib/hygiene/types'

export type StageInfo = {
  label: string
  isClosed: boolean
  // Avancement dans le tunnel, 0→1 (1 = proche du closing). Probabilité HubSpot
  // si définie, sinon rang normalisé parmi les phases ouvertes (displayOrder).
  advancement: number | null
}

export type DealPhaseContext = {
  stage_label: string | null
  // Phase reconnue dans le tunnel ET non clôturée (deal encore en course).
  is_open: boolean
  advancement: number | null
  // Jours depuis la dernière activité (dernier appel) — proxy d'inactivité.
  days_inactive: number
  // Critères de sortie de la phase courante non remplis (libellés, via hygiène).
  unmet_criteria: string[]
  // La phase CRM ne reflète pas la réalité du dernier appel (via hygiène).
  stage_mismatch: boolean
}

/**
 * Retrouve une phase dans la carte du tunnel et calcule son avancement.
 * advancement = probabilité HubSpot si fournie ; sinon rang normalisé parmi les
 * phases OUVERTES du même pipeline (1re ouverte = 0, dernière ouverte = 1).
 * Renvoie null si le stage n'est reconnu dans aucun pipeline.
 */
export function findStageInfo(
  pipelines: CrmPipeline[],
  stageId: string | null,
): StageInfo | null {
  if (!stageId) return null

  for (const p of pipelines) {
    const stage = p.stages.find((s) => s.id === stageId)
    if (!stage) continue

    let advancement: number | null = stage.probability
    if (advancement == null && !stage.isClosed) {
      // Repli : position parmi les phases ouvertes, triées par displayOrder.
      const open = p.stages
        .filter((s) => !s.isClosed)
        .sort((a, b) => a.displayOrder - b.displayOrder)
      const idx = open.findIndex((s) => s.id === stageId)
      if (idx >= 0 && open.length > 1) {
        advancement = idx / (open.length - 1)
      }
    }

    return { label: stage.label, isClosed: stage.isClosed, advancement }
  }

  return null
}

export type BuildPhaseContextInput = {
  stageId: string | null
  pipelines: CrmPipeline[]
  // Écarts d'hygiène déjà calculés pour ce deal (cache J30) — peut être vide.
  gaps: HygieneGap[]
  daysInactive: number
}

/**
 * Assemble le contexte phase d'un deal. Renvoie null si la phase n'est pas
 * reconnue dans le tunnel (rien à enrichir — l'alerte reste celle du J24).
 */
export function buildDealPhaseContext(
  input: BuildPhaseContextInput,
): DealPhaseContext | null {
  const info = findStageInfo(input.pipelines, input.stageId)
  if (!info) return null

  // Critères de sortie non remplis (écart IA J30).
  const unmetGap = input.gaps.find((g) => g.type === 'exit_criteria_unmet')
  const unmet_criteria = (unmetGap?.unmet_criteria ?? []).map((c) => c.label)

  // Phase CRM ≠ réalité de l'appel (écart IA J30).
  const stage_mismatch = input.gaps.some(
    (g) => g.type === 'stage_reality_mismatch',
  )

  return {
    stage_label: info.label,
    is_open: !info.isClosed,
    advancement: info.advancement,
    days_inactive: Math.max(0, Math.floor(input.daysInactive)),
    unmet_criteria,
    stage_mismatch,
  }
}
