/**
 * Alerte coaching (J24) — LA fonctionnalité de pilotage
 * -----------------------------------------------------
 * Le cap produit : « 1 alerte actionnable > 50 KPIs » (cf. mémoire
 * project_pilotage_scoring_pivot). On balaie les deals d'une équipe, on garde
 * ceux dont l'engagement DÉCROCHE (trend = baisse, calculé par le momentum du
 * J23), et on transforme la trajectoire en un brief 1:1 pour le manager :
 * « voici le deal que ton commercial va perdre, voici pourquoi, voici l'action ».
 *
 * Fonction PURE et DÉTERMINISTE : l'action est composée à partir des codes de
 * raisons déjà calculés par `computeDealMomentum` — aucun appel IA, aucun coût,
 * un texte stable (choix validé avec Nizar). Une variante rédigée par l'IA
 * pourra venir se poser par-dessus plus tard.
 */

import type {
  DealMomentum,
  MomentumReason,
  MomentumSignalCode,
} from '@/lib/metrics/momentum'
import type { DealPhaseContext } from '@/lib/metrics/phase-context'

/** Identité d'un deal nécessaire pour composer l'alerte (sans les points). */
export type DealIdentity = {
  // Clé de regroupement encodée (deal:<id> | phone:<num>) — sert au lien UI.
  group_key: string
  contact_name: string | null
  company_name: string | null
  deal_name: string | null
  // Commercial « propriétaire » du deal (dernier appel) — pour cibler le 1:1.
  owner_name: string | null
  calls_count: number
}

export type AlertSeverity = 'haute' | 'moyenne'

// Signaux propres à la PHASE du tunnel (J32) — distincts des signaux de momentum
// (J23), pour ne pas toucher au moteur in-call/CRM.
export type PhaseSignalCode =
  | 'stage_stuck' // deal en phase ouverte, sans activité depuis longtemps
  | 'exit_criteria_gap' // critères de sortie de la phase non remplis
  | 'stage_mismatch' // phase CRM ≠ réalité du dernier appel

// Une raison d'alerte = un signal de momentum OU un signal de phase. Le champ
// `text` est toujours présent → l'affichage et le push HubSpot (J26) restent
// inchangés (ils n'utilisent que `text`).
export type AlertReason =
  | MomentumReason
  | { code: PhaseSignalCode; text: string }

export type CoachingAlert = {
  group_key: string
  title: string // « Contact · Entreprise » (ce qu'on affiche en tête d'alerte)
  owner_name: string | null
  calls_count: number
  severity: AlertSeverity
  reasons: AlertReason[]
  action: string // le brief 1:1, déterministe
  first_engagement: number | null
  last_engagement: number | null
  // Phase HubSpot du deal (J32) — affichée près de l'alerte, null si inconnue.
  stage_label: string | null
}

/**
 * Seuils de l'alerte. Séparés du momentum car c'est une décision « produit »
 * (quoi remonter au manager) et non « mesure ».
 */
export const ALERT_THRESHOLDS = {
  // En-dessous, l'engagement du dernier appel est jugé critique.
  criticalLastEngagement: 35,
  // Chute (premier → dernier) à partir de laquelle l'alerte passe en « haute ».
  highDrop: 30,
  // J32 — avancement (0→1) au-delà duquel un décrochage en phase OUVERTE passe
  // en « haute » : perdre un deal en fin de tunnel coûte plus cher.
  lateStageAdvancement: 0.66,
  // J32 — jours sans activité au-delà desquels on signale un deal « figé » dans
  // sa phase (proxy : jours depuis le dernier appel).
  stuckDays: 14,
} as const

// Action 1:1 par code de signal. Priorité décroissante : on prend la 1re
// raison présente dans cet ordre comme action principale (la plus actionnable).
const ACTION_BY_CODE: Record<MomentumSignalCode, string> = {
  next_step_weaker:
    "Rappeler pour verrouiller un prochain pas concret et daté — pas un énième mail de relance.",
  buying_drop:
    "Creuser un frein interne non dit : reformuler le besoin et identifier qui décide vraiment.",
  objection_fake:
    "Traiter le désengagement de front : demander franchement où en est la décision plutôt que de relancer à l'aveugle.",
  prospect_quieter:
    "Reprendre la main avec des questions ouvertes — le prospect se referme, il faut le faire reparler.",
  crm_slow_velocity:
    "Changer de canal (appel direct) : le délai de réponse s'allonge, l'email ne suffit plus.",
  crm_mono_thread:
    "Impliquer le décideur (DAF/boss) : un deal mono-interlocuteur est fragile.",
  insufficient_data:
    "Passer un appel de qualification : on manque d'éléments pour lire ce deal.",
}

// Ordre de priorité pour choisir l'action dominante.
const CODE_PRIORITY: MomentumSignalCode[] = [
  'next_step_weaker',
  'buying_drop',
  'objection_fake',
  'prospect_quieter',
  'crm_slow_velocity',
  'crm_mono_thread',
  'insufficient_data',
]

function pickAction(reasons: MomentumReason[]): string {
  const codes = new Set(reasons.map((r) => r.code))
  for (const code of CODE_PRIORITY) {
    if (codes.has(code)) return ACTION_BY_CODE[code]
  }
  // Filet de sécurité : trend=baisse sans raison identifiée (rare).
  return "Reprendre contact pour comprendre ce qui a changé côté prospect."
}

// --- Conscience de la phase (J32) -------------------------------------------

// Construit les raisons « phase » à partir du contexte tunnel. Renvoyées en TÊTE
// des raisons (plus concrètes/actionnables que les signaux in-call génériques).
function phaseReasons(
  phase: DealPhaseContext,
): { code: PhaseSignalCode; text: string }[] {
  const reasons: { code: PhaseSignalCode; text: string }[] = []
  const stage = phase.stage_label ?? 'phase actuelle'

  if (phase.stage_mismatch) {
    reasons.push({
      code: 'stage_mismatch',
      text: `La phase CRM (« ${stage} ») ne reflète pas la réalité du dernier appel.`,
    })
  }
  if (phase.unmet_criteria.length > 0) {
    reasons.push({
      code: 'exit_criteria_gap',
      text: `Critères pour sortir de « ${stage} » non remplis : ${phase.unmet_criteria.join(', ')}.`,
    })
  }
  if (phase.is_open && phase.days_inactive >= ALERT_THRESHOLDS.stuckDays) {
    reasons.push({
      code: 'stage_stuck',
      text: `Figé en « ${stage} » — aucune activité depuis ${phase.days_inactive} j.`,
    })
  }

  return reasons
}

// Action 1:1 phase-aware : plus concrète que l'action de momentum quand un signal
// de phase domine. Priorité : mismatch > critères manquants > figé.
function pickPhaseAction(
  phase: DealPhaseContext,
  phaseSignals: { code: PhaseSignalCode }[],
): string | null {
  const codes = new Set(phaseSignals.map((r) => r.code))
  const stage = phase.stage_label ?? 'la phase actuelle'

  if (codes.has('stage_mismatch')) {
    return `Le dernier appel ne colle pas à la phase « ${stage} » : clarifier où en est vraiment le prospect avant d'avancer le deal.`
  }
  if (codes.has('exit_criteria_gap')) {
    return `Sécuriser les points bloquants pour sortir de « ${stage} » : ${phase.unmet_criteria.join(', ')}.`
  }
  if (codes.has('stage_stuck')) {
    return `Relancer activement le deal figé en « ${stage} » : un appel pour débloquer le frein réel, pas un mail de relance.`
  }
  return null
}

/**
 * Construit l'alerte coaching d'UN deal à partir de son momentum déjà calculé.
 * Renvoie null si le deal ne décroche pas (trend ≠ baisse) → pas d'alerte.
 * C'est ce qui permet de poser une alerte directement sur la carte d'un deal
 * dans la liste, sans pré-filtrer (J24bis).
 */
export function buildAlertForDeal(
  deal: DealIdentity,
  momentum: DealMomentum,
  phase?: DealPhaseContext | null,
): CoachingAlert | null {
  // J32 : la phase ENRICHIT une alerte de décrochage existante, elle n'en crée
  // pas. Les problèmes purement « tunnel » sans décrochage (deal figé, critères
  // non remplis) sont déjà couverts par le moteur d'hygiène (J30/J31).
  if (momentum.trend !== 'baisse') return null

  const last = momentum.last_engagement
  const first = momentum.first_engagement
  const drop = first != null && last != null ? first - last : 0
  let severity: AlertSeverity =
    (last != null && last < ALERT_THRESHOLDS.criticalLastEngagement) ||
    drop >= ALERT_THRESHOLDS.highDrop
      ? 'haute'
      : 'moyenne'

  // Signaux de phase (J32) — calculés seulement si on a un contexte tunnel.
  const phaseSignals = phase ? phaseReasons(phase) : []

  // Montée de sévérité consciente du tunnel : un décrochage en phase OUVERTE
  // avancée, ou une phase CRM en décalage avec l'appel, passe en « haute ».
  if (
    phase &&
    (severity === 'moyenne') &&
    ((phase.is_open &&
      (phase.advancement ?? 0) >= ALERT_THRESHOLDS.lateStageAdvancement) ||
      phase.stage_mismatch)
  ) {
    severity = 'haute'
  }

  const title =
    [deal.contact_name, deal.company_name].filter(Boolean).join(' · ') ||
    deal.deal_name ||
    'Deal sans nom'

  // Action : une action de phase concrète prime quand un signal de phase domine,
  // sinon on retombe sur l'action de momentum (J24).
  const action =
    (phase && pickPhaseAction(phase, phaseSignals)) ??
    pickAction(momentum.reasons)

  return {
    group_key: deal.group_key,
    title,
    owner_name: deal.owner_name,
    calls_count: deal.calls_count,
    severity,
    // Raisons de phase EN TÊTE (plus concrètes), puis les raisons de momentum.
    reasons: [...phaseSignals, ...momentum.reasons],
    action,
    first_engagement: first,
    last_engagement: last,
    stage_label: phase?.stage_label ?? null,
  }
}

/** Rang de sévérité pour le tri (haute avant moyenne avant pas d'alerte). */
export function severityRank(alert: CoachingAlert | null): number {
  if (!alert) return 2
  return alert.severity === 'haute' ? 0 : 1
}
