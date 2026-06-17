// ============================================================================
// lib/metrics/forecast-confidence.ts — Fiabilité du forecast (J33)
// ============================================================================
// Positionnement ASSUMÉ : « on ne fait pas ton forecast, on le FIABILISE ». On ne
// produit pas de prévision chiffrée (marché Clari encombré) — on compare, par
// deal, la CONFIANCE DÉCLARÉE par le CRM (avancement de phase HubSpot) à
// l'ENGAGEMENT RÉEL mesuré par Aloalo (momentum J23 + décrochage J24 + écarts
// d'hygiène J30/J32). L'écart révèle les deals « optimistes » qui gonflent le
// forecast jusqu'à ce qu'ils glissent.
//
// Fonction PURE, sur des données DÉJÀ chargées (aucun appel HubSpot, aucune IA,
// aucune migration). Surface volontairement légère (feature d'appoint 🟡) :
// signal qualitatif + comptage, pas de montants € (non stockés).
// ============================================================================

export type ForecastVerdict =
  | 'aligné' // confiance déclarée ≈ engagement réel
  | 'optimiste' // CRM trop confiant vs réalité → gonfle le forecast
  | 'sous-estimé' // engagement réel > confiance déclarée → upside possible
  | 'indéterminé' // pas assez d'éléments (phase fermée/inconnue, pas d'engagement)

export type ForecastConfidence = {
  verdict: ForecastVerdict
  // 0-100, pour l'affichage (barres). null si non évaluable.
  declared: number | null
  observed: number | null
  reason: string
}

export const FORECAST_THRESHOLDS = {
  // Écart (points sur 100) déclaré − observé au-delà duquel on tranche.
  divergenceGap: 25,
  // Pénalités appliquées à l'engagement observé selon les signaux négatifs.
  decliningPenalty: 15,
  unmetCriteriaPenalty: 10,
  stageMismatchPenalty: 10,
} as const

export type ForecastInput = {
  // Avancement de la phase dans le tunnel (0→1) = confiance déclarée par le CRM.
  advancement: number | null
  // La phase est-elle ouverte ? (un deal gagné/perdu n'est plus « au forecast »).
  isOpen: boolean
  // Engagement réel du dernier appel (0-100, cf. momentum).
  lastEngagement: number | null
  // Le deal décroche-t-il (alerte coaching active) ?
  declining: boolean
  // Des critères de sortie de la phase sont-ils non remplis ? (hygiène J30)
  unmetCriteria: boolean
  // La phase CRM contredit-elle le dernier appel ? (hygiène J30)
  stageMismatch: boolean
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Évalue la fiabilité du forecast d'UN deal. Renvoie 'indéterminé' (sans déclaré
 * ni observé) si la phase est fermée/inconnue ou si l'engagement n'est pas
 * calculable — on n'invente jamais une confiance.
 */
export function computeForecastConfidence(
  input: ForecastInput,
): ForecastConfidence {
  if (!input.isOpen || input.advancement == null || input.lastEngagement == null) {
    return {
      verdict: 'indéterminé',
      declared: null,
      observed: null,
      reason:
        "Pas assez d'éléments (phase ou engagement) pour évaluer la fiabilité.",
    }
  }

  const declared = Math.round(clamp(input.advancement, 0, 1) * 100)

  // Engagement observé pénalisé par les signaux négatifs (décrochage, critères
  // non remplis, phase ≠ réalité) : la « vraie » confiance qu'Aloalo lit.
  const penalty =
    (input.declining ? FORECAST_THRESHOLDS.decliningPenalty : 0) +
    (input.unmetCriteria ? FORECAST_THRESHOLDS.unmetCriteriaPenalty : 0) +
    (input.stageMismatch ? FORECAST_THRESHOLDS.stageMismatchPenalty : 0)
  const observed = Math.round(clamp(input.lastEngagement - penalty, 0, 100))

  const diff = declared - observed

  if (diff >= FORECAST_THRESHOLDS.divergenceGap) {
    return {
      verdict: 'optimiste',
      declared,
      observed,
      reason:
        "Le CRM affiche une confiance élevée, mais l'engagement réel est plus faible — ce deal risque de gonfler le forecast.",
    }
  }
  if (diff <= -FORECAST_THRESHOLDS.divergenceGap) {
    return {
      verdict: 'sous-estimé',
      declared,
      observed,
      reason:
        "L'engagement réel dépasse la confiance déclarée — possible upside non reflété dans le forecast.",
    }
  }
  return {
    verdict: 'aligné',
    declared,
    observed,
    reason: 'Confiance déclarée et engagement réel cohérents.',
  }
}
