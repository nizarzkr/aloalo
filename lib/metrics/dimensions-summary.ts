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

import type { DimensionEval, DimensionStatus } from '@/lib/claude'

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
