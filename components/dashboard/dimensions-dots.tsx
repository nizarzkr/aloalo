// ============================================================================
// DimensionsDots — résumé visuel des dimensions d'un appel pour les listes (J25)
// ============================================================================
// Remplace la colonne « X% » dans les listes (accueil, appels, fiche commercial).
// 5 pastilles colorées dans l'ordre des dimensions = exactement le langage de la
// barre de synthèse en haut du détail (vert = validé, orange = partiel, rouge =
// manqué, gris = dimension absente). Aucun score agrégé.
//
// Composant serveur (rendu SSR dans les listes) : pas de tooltip interactif, on
// passe le résumé via `title`/`aria-label` natifs.
// ============================================================================

import {
  DIMENSION_META,
  DIMENSION_ORDER,
  STATUS_META,
} from '@/components/dashboard/dimensions-eval'
import {
  safeDimensionStatus,
  summarizeDimensions,
  summaryLabel,
} from '@/lib/metrics/dimensions-summary'
import { cn } from '@/lib/utils'
import type { DimensionEval } from '@/lib/claude'

export function DimensionsDots({ dimensions }: { dimensions: unknown }) {
  const summary = summarizeDimensions(dimensions)
  // Appel pré-J21 / non analysé → tiret neutre, comme l'ancien « – ».
  if (!summary) {
    return <span className="text-sm text-muted-foreground">–</span>
  }

  const arr = dimensions as DimensionEval[]
  const byKey = new Map(arr.map((d) => [d?.key, d]))
  const label = summaryLabel(summary)

  return (
    <span
      className="inline-flex items-center gap-1"
      title={label}
      aria-label={label}
    >
      {DIMENSION_ORDER.map((key) => {
        const dim = byKey.get(key)
        const dotClass = dim
          ? STATUS_META[safeDimensionStatus(dim.status)].dot
          : 'bg-muted-foreground/25' // dimension absente de l'analyse
        return (
          <span
            key={key}
            className={cn('size-2 rounded-full', dotClass)}
            aria-hidden
          >
            <span className="sr-only">{DIMENSION_META[key].short}</span>
          </span>
        )
      })}
    </span>
  )
}
