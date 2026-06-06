// ============================================================================
// Helpers de statut d'appel (J22bis — suivi de phase live)
// ============================================================================
// Le pipeline d'un appel : pending → transcribing → transcribed → analyzing →
// analyzed (ou failed). « En cours » = tout sauf les deux états terminaux.
// Partagé entre le rendu serveur (page + routes) et le polling client, pour que
// la signature de suivi soit calculée de façon identique des deux côtés.
// ============================================================================

// Statuts non terminaux : un appel dans l'un de ces états est encore en
// traitement (donc à suivre / rafraîchir automatiquement).
export const IN_PROGRESS_STATUSES = [
  'pending',
  'transcribing',
  'transcribed',
  'analyzing',
] as const

export function isTerminalStatus(status: string): boolean {
  return status === 'analyzed' || status === 'failed'
}

// Signature compacte d'un ensemble d'appels en cours : « id:status » triés et
// joints. Elle change dès qu'un appel avance de phase OU quitte l'ensemble
// (terminé) → c'est notre détecteur de « quelque chose a bougé ».
export function buildSignature(
  rows: Array<{ id: string; status: string }>,
): string {
  return rows
    .map((r) => `${r.id}:${r.status}`)
    .sort()
    .join(',')
}
