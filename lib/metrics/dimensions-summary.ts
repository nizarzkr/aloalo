// ============================================================================
// Résumé des dimensions d'un appel (J25)
// ============================================================================
// Depuis J21, l'unité de vérité d'un appel n'est plus un score /100 mais les
// 5 dimensions (validé / partiel / manqué). Ce helper PUR condense ces
// dimensions en compteurs, pour afficher dans les listes/KPI le MÊME langage
// que la page de détail (pastilles, « N validées »), sans réintroduire de score.
//
// `dimensions` arrive en jsonb depuis la base (objet/tableau non typé), d'où le
// `unknown` en entrée et les gardes défensives.
// ============================================================================

import type { DimensionEval, DimensionKey, DimensionStatus } from '@/lib/claude'

export type DimensionsSummary = {
  validated: number // nb de dimensions « validé »
  partial: number // nb « partiel »
  missed: number // nb « manqué »
  total: number // nb de dimensions présentes (normalement 5)
}

// Normalise un statut potentiellement inattendu (vieille donnée / sortie IA) en
// repli 'partiel' — jamais de crash de rendu.
export function safeDimensionStatus(status: unknown): DimensionStatus {
  return status === 'validé' || status === 'partiel' || status === 'manqué'
    ? status
    : 'partiel'
}

// Condense un tableau de dimensions en compteurs. Renvoie null si l'appel n'a
// pas de dimensions (appel pré-J21 / non analysé) → l'appelant affiche « – ».
export function summarizeDimensions(dimensions: unknown): DimensionsSummary | null {
  if (!Array.isArray(dimensions) || dimensions.length === 0) return null
  let validated = 0
  let partial = 0
  let missed = 0
  for (const d of dimensions as DimensionEval[]) {
    const s = safeDimensionStatus(d?.status)
    if (s === 'validé') validated++
    else if (s === 'partiel') partial++
    else missed++
  }
  return { validated, partial, missed, total: dimensions.length }
}

// Phrase de résumé accessible (title/aria) : « 3 validées · 1 partielle · 1 manquée ».
export function summaryLabel(s: DimensionsSummary): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
  return [
    plural(s.validated, 'validée', 'validées'),
    plural(s.partial, 'partielle', 'partielles'),
    plural(s.missed, 'manquée', 'manquées'),
  ].join(' · ')
}

// ============================================================================
// Agrégat MULTI-APPELS par dimension (J36 — profil de coaching)
// ============================================================================
// Condense les dimensions de N appels en compteurs PAR dimension. Permet de
// faire ressortir, sur la durée, l'axe de progression récurrent et le point fort
// d'un commercial. Pur : `dimensionsList` = un élément (jsonb non typé) par appel.

export type DimensionStat = {
  key: DimensionKey
  validated: number
  partial: number
  missed: number
  total: number
}

const DIMENSION_KEYS: DimensionKey[] = [
  'discovery',
  'qualification',
  'objection_handling',
  'closing',
  'next_step',
]

export function aggregateDimensionStats(
  dimensionsList: unknown[],
): Record<DimensionKey, DimensionStat> {
  const stats = Object.fromEntries(
    DIMENSION_KEYS.map((key) => [key, { key, validated: 0, partial: 0, missed: 0, total: 0 }]),
  ) as Record<DimensionKey, DimensionStat>

  for (const dims of dimensionsList) {
    if (!Array.isArray(dims)) continue
    for (const d of dims as DimensionEval[]) {
      const key = d?.key
      if (!key || !(key in stats)) continue
      const s = safeDimensionStatus(d.status)
      if (s === 'validé') stats[key].validated++
      else if (s === 'partiel') stats[key].partial++
      else stats[key].missed++
      stats[key].total++
    }
  }
  return stats
}

// Score de « non-maîtrise » d'une dimension (0 = parfait, 1 = toujours manqué).
// Une dimension manquée pèse plus qu'une partielle.
function gapScore(s: DimensionStat): number {
  if (s.total === 0) return -1 // pas d'échantillon → jamais choisi
  return (s.missed + s.partial * 0.5) / s.total
}

// Axe de progression = la dimension la moins maîtrisée (avec assez d'échantillons).
// Renvoie null si rien d'exploitable (pas d'appels analysés).
export function pickProgressionAxis(
  stats: Record<DimensionKey, DimensionStat>,
  minSamples = 2,
): DimensionStat | null {
  let best: DimensionStat | null = null
  let bestScore = 0
  for (const s of Object.values(stats)) {
    if (s.total < minSamples) continue
    const score = gapScore(s)
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return best
}

// Point fort = la dimension la plus validée (avec assez d'échantillons).
export function pickStrengthAxis(
  stats: Record<DimensionKey, DimensionStat>,
  minSamples = 2,
): DimensionStat | null {
  let best: DimensionStat | null = null
  let bestRate = -1
  for (const s of Object.values(stats)) {
    if (s.total < minSamples) continue
    const rate = s.validated / s.total
    if (rate > bestRate) {
      bestRate = rate
      best = s
    }
  }
  return best
}
