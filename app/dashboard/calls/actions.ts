'use server'

// ============================================================================
// Server Actions — revalidation du rendu serveur après un changement de phase.
// ============================================================================
// Le polling client (routes GET) détecte qu'un appel a changé de phase, mais en
// Next 16 il faut invalider le cache RSC côté serveur (revalidatePath) pour que
// router.refresh() ramène le nouveau rendu (analyse, badge à jour…). Ces actions
// font exactement ça — appelées par les composants client au bon moment.
// ============================================================================

import { revalidatePath } from 'next/cache'

export async function revalidateCall(callId: string): Promise<void> {
  revalidatePath(`/dashboard/calls/${callId}`)
}

export async function revalidateCallsList(): Promise<void> {
  revalidatePath('/dashboard/calls')
}

export async function revalidateDashboardHome(): Promise<void> {
  revalidatePath('/dashboard')
}
