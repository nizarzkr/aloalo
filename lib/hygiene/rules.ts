// ============================================================================
// lib/hygiene/rules.ts — Règles de détection d'écarts (J30), PURES
// ============================================================================
// Aucune I/O : ces fonctions transforment des données déjà chargées en écarts
// typés. Testées unitairement (rules.test.ts). Deux sources :
//   - déterministe (gratuit) : deriveDeterministicGaps
//   - IA (passe légère)      : gapsFromAiEval (mappe la sortie de l'évaluateur)
// puis prioritizeGaps trie le tout par sévérité.
// ============================================================================

import type { ExitCriterion } from '@/lib/exit-criteria'
import type {
  HygieneGap,
  HygieneSeverity,
} from '@/lib/hygiene/types'

// --- Déterministe -----------------------------------------------------------

export type DeterministicInput = {
  // Le deal a-t-il un id HubSpot (donc un CRM à tenir propre) ?
  hasDealId: boolean
  // La phase courante (dealstage) est-elle reconnue dans le tunnel synchronisé ?
  stageKnown: boolean
  // Statut agrégé du deal (cf. lib/deals/aggregate).
  status: 'gagné' | 'perdu' | 'actif' | 'dormant'
  // Nb de tâches de suivi datées dans la DERNIÈRE analyse du deal.
  latestSuggestedTasksCount: number
}

/**
 * Écarts détectables sans IA, depuis l'état agrégé du deal.
 *  - dormant_open_deal : deal ni gagné ni perdu, sans activité récente.
 *  - no_next_step      : deal actif sans prochaine étape datée.
 *  - stage_unmapped    : deal dans HubSpot mais phase non reconnue (CRM mal tenu).
 */
export function deriveDeterministicGaps(
  input: DeterministicInput,
): HygieneGap[] {
  const gaps: HygieneGap[] = []

  if (input.status === 'dormant') {
    gaps.push({
      type: 'dormant_open_deal',
      severity: 'high',
      title: 'Deal en sommeil',
      detail:
        "Ce deal est encore ouvert mais n'a aucune activité récente. Relancer ou requalifier (perdu ?) pour ne pas fausser le pipeline.",
      suggested_action: 'create_task',
    })
  }

  if (input.status === 'actif' && input.latestSuggestedTasksCount === 0) {
    gaps.push({
      type: 'no_next_step',
      severity: 'medium',
      title: 'Pas de prochaine étape datée',
      detail:
        "Le dernier appel ne débouche sur aucune action datée. Un deal sans next step avance rarement — planifier la suite.",
      suggested_action: 'create_task',
    })
  }

  if (input.hasDealId && !input.stageKnown) {
    gaps.push({
      type: 'stage_unmapped',
      severity: 'low',
      title: 'Phase HubSpot non reconnue',
      detail:
        "La phase de ce deal n'est pas reconnue dans le tunnel synchronisé. Vérifier la phase du deal dans HubSpot ou re-synchroniser le tunnel.",
      suggested_action: 'update_stage',
    })
  }

  return gaps
}

// --- Mapping de la passe IA -------------------------------------------------

export type HygieneEvalResult = {
  exit_criteria: { id: string; met: boolean; evidence: string }[]
  stage_mismatch: {
    mismatch: boolean
    reason: string
    suggested_direction: 'earlier' | 'later' | 'none'
  }
}

const DIRECTION_HINT: Record<
  HygieneEvalResult['stage_mismatch']['suggested_direction'],
  string
> = {
  earlier: 'Le deal semble moins avancé que sa phase actuelle.',
  later: 'Le deal semble plus avancé que sa phase actuelle.',
  none: '',
}

/**
 * Transforme la sortie de l'évaluateur IA en écarts. On ne garde que les
 * critères réellement fournis (lookup par id ⇒ ignore une éventuelle
 * hallucination d'id) et non remplis.
 */
export function gapsFromAiEval(
  criteria: ExitCriterion[],
  result: HygieneEvalResult,
): HygieneGap[] {
  const gaps: HygieneGap[] = []
  const labelById = new Map(criteria.map((c) => [c.id, c.label]))

  const unmet = result.exit_criteria
    .filter((e) => !e.met && labelById.has(e.id))
    .map((e) => ({ id: e.id, label: labelById.get(e.id)! }))

  if (unmet.length > 0) {
    gaps.push({
      type: 'exit_criteria_unmet',
      severity: 'medium',
      title:
        unmet.length === 1
          ? '1 critère de sortie non rempli'
          : `${unmet.length} critères de sortie non remplis`,
      detail:
        'La phase courante a des critères de sortie que l’appel ne valide pas encore. À traiter avant de faire avancer le deal.',
      unmet_criteria: unmet,
      suggested_action: 'create_task',
    })
  }

  if (result.stage_mismatch.mismatch) {
    const hint = DIRECTION_HINT[result.stage_mismatch.suggested_direction]
    gaps.push({
      type: 'stage_reality_mismatch',
      severity: 'high',
      title: 'Phase CRM ≠ réalité de l’appel',
      detail: result.stage_mismatch.reason,
      suggested_stage_hint: hint || undefined,
      suggested_action: 'update_stage',
    })
  }

  return gaps
}

// --- Priorisation -----------------------------------------------------------

const SEVERITY_RANK: Record<HygieneSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/**
 * Trie les écarts par sévérité décroissante (high → low), de façon STABLE
 * (l'ordre d'insertion départage à sévérité égale).
 */
export function prioritizeGaps(gaps: HygieneGap[]): HygieneGap[] {
  return gaps
    .map((g, i) => ({ g, i }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.g.severity] - SEVERITY_RANK[b.g.severity] ||
        a.i - b.i,
    )
    .map(({ g }) => g)
}
