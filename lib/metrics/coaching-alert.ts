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

export type CoachingAlert = {
  group_key: string
  title: string // « Contact · Entreprise » (ce qu'on affiche en tête d'alerte)
  owner_name: string | null
  calls_count: number
  severity: AlertSeverity
  reasons: MomentumReason[]
  action: string // le brief 1:1, déterministe
  first_engagement: number | null
  last_engagement: number | null
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

/**
 * Construit l'alerte coaching d'UN deal à partir de son momentum déjà calculé.
 * Renvoie null si le deal ne décroche pas (trend ≠ baisse) → pas d'alerte.
 * C'est ce qui permet de poser une alerte directement sur la carte d'un deal
 * dans la liste, sans pré-filtrer (J24bis).
 */
export function buildAlertForDeal(
  deal: DealIdentity,
  momentum: DealMomentum,
): CoachingAlert | null {
  if (momentum.trend !== 'baisse') return null

  const last = momentum.last_engagement
  const first = momentum.first_engagement
  const drop = first != null && last != null ? first - last : 0
  const severity: AlertSeverity =
    (last != null && last < ALERT_THRESHOLDS.criticalLastEngagement) ||
    drop >= ALERT_THRESHOLDS.highDrop
      ? 'haute'
      : 'moyenne'

  const title =
    [deal.contact_name, deal.company_name].filter(Boolean).join(' · ') ||
    deal.deal_name ||
    'Deal sans nom'

  return {
    group_key: deal.group_key,
    title,
    owner_name: deal.owner_name,
    calls_count: deal.calls_count,
    severity,
    reasons: momentum.reasons,
    action: pickAction(momentum.reasons),
    first_engagement: first,
    last_engagement: last,
  }
}

/** Rang de sévérité pour le tri (haute avant moyenne avant pas d'alerte). */
export function severityRank(alert: CoachingAlert | null): number {
  if (!alert) return 2
  return alert.severity === 'haute' ? 0 : 1
}
