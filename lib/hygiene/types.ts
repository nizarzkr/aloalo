// ============================================================================
// lib/hygiene/types.ts — Modèle d'écart d'hygiène de pipeline (J30)
// ============================================================================
// #1 Pipeline Hygiene Engine (1/2). Un « écart » (gap) = une incohérence dit/CRM
// détectée sur un deal. Certains écarts sont déterministes (règles gratuites),
// d'autres viennent d'une passe IA légère (lecture sémantique). La liste est
// PRIORISÉE par sévérité ; J31 l'affiche + propose la correction 1 clic.
// ============================================================================

export type HygieneGapType =
  // IA : la réalité de l'appel contredit la phase CRM du deal.
  | 'stage_reality_mismatch'
  // IA : des critères de sortie de la phase courante ne sont pas remplis.
  | 'exit_criteria_unmet'
  // Règle : deal actif sans prochaine étape datée (dernière analyse).
  | 'no_next_step'
  // Règle : deal ouvert sans activité depuis > seuil dormant.
  | 'dormant_open_deal'
  // Règle : deal présent dans HubSpot mais sans phase reconnue dans le tunnel.
  | 'stage_unmapped'

export type HygieneSeverity = 'high' | 'medium' | 'low'

// Action de correction suggérée (consommée par J31 pour le 1 clic). null = pas
// d'action automatisable proposée à ce stade.
export type HygieneSuggestedAction = 'create_task' | 'update_stage' | null

export type HygieneGap = {
  type: HygieneGapType
  severity: HygieneSeverity
  title: string // libellé FR court (affiché tel quel)
  detail: string // explication (peut citer l'appel)
  // exit_criteria_unmet : les critères non remplis (id stable J28 + libellé).
  unmet_criteria?: { id: string; label: string }[]
  // stage_reality_mismatch : indice de la phase suggérée par l'appel.
  suggested_stage_hint?: string
  suggested_action?: HygieneSuggestedAction
}

// Rapport d'hygiène d'un deal (forme persistée dans deal_hygiene.gaps + méta).
export type HygieneReport = {
  group_key: string
  stage_id: string | null
  gaps: HygieneGap[]
  calls_signature: string
  criteria_fingerprint: string
  cost_eur: number | null
  computed_at: string
}
