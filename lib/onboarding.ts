// ============================================================================
// lib/onboarding.ts — État du parcours d'onboarding assisté (J29)
// ============================================================================
// Socle #3 (3/3) de la Semaine 4 : l'assistant /onboarding enchaîne téléphonie
// (Ringover) → HubSpot → critères de sortie IA. La PROGRESSION n'est pas stockée
// comme un pointeur d'étape : chaque étape est « faite » si son SIGNAL RÉEL est
// présent en base (clé Ringover ? token + tunnel synchronisé ? critères ?). On
// évite ainsi un doublon de vérité (même principe que J27/J28) : la reprise se
// recale toute seule, même si l'owner abandonne en cours de route.
//
// Seul un horodatage de complétion (organizations.onboarding_completed_at, cf.
// migration 0027) dit « l'owner a fini l'assistant » → on arrête de le rediriger.
//
// Lecture en admin client (bypass RLS) : depuis l'issue #5, ringover_api_key /
// hubspot_token ne sont plus lisibles par le client RLS. On ne dérive QUE des
// booléens de présence, jamais une valeur secrète. Module hors `'use server'`
// pour rester importable par les Server Components (cf. lib/deals/pushed-actions).
// ============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'

import { hasSecret } from '@/lib/crypto/org-secrets'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

// Ordre du parcours, décidé avec Nizar : la téléphonie d'abord (la source des
// appels), puis HubSpot (qui débloque le tunnel), puis les critères IA.
export type OnboardingStepId = 'telephony' | 'hubspot' | 'criteria'

export const ONBOARDING_STEPS: readonly OnboardingStepId[] = [
  'telephony',
  'hubspot',
  'criteria',
] as const

// Cookie de snooze (« passer pour l'instant ») : suspend la redirection auto vers
// /onboarding (cf. app/dashboard/layout.tsx) sans marquer l'onboarding terminé.
// Vit ici (et non dans actions.ts) car un module `'use server'` ne peut exporter
// que des fonctions async, pas une constante.
export const ONBOARDING_SNOOZE_COOKIE = 'aloalo_onboarding_snoozed'

// Signaux bruts lus en base, donnés à la fonction pure deriveSteps.
export type OnboardingSignals = {
  hasRingoverKey: boolean
  hasHubspotToken: boolean
  hasPipelines: boolean
  hasExitCriteria: boolean
}

export type OnboardingState = {
  steps: Record<OnboardingStepId, boolean>
  /** Nombre d'étapes faites (0..3). */
  doneCount: number
  /** Première étape non faite, ou null si toutes faites. */
  firstIncompleteStep: OnboardingStepId | null
  /** Horodatage de fin de l'assistant (null = non terminé). */
  completedAt: string | null
}

/**
 * Dérive l'état des étapes depuis les signaux réels. Fonction PURE (testée
 * unitairement) : aucune I/O, pour figer la logique « étape faite = signal
 * présent » indépendamment de la lecture DB.
 *
 * - telephony : la clé API Ringover est enregistrée.
 * - hubspot   : le token est présent ET le tunnel a été synchronisé (un token
 *               sans tunnel = connexion incomplète, l'étape n'est pas « faite »).
 * - criteria  : au moins une phase a des critères de sortie enregistrés.
 */
export function deriveSteps(
  signals: OnboardingSignals,
  completedAt: string | null,
): OnboardingState {
  const steps: Record<OnboardingStepId, boolean> = {
    telephony: signals.hasRingoverKey,
    hubspot: signals.hasHubspotToken && signals.hasPipelines,
    criteria: signals.hasExitCriteria,
  }

  const doneCount = ONBOARDING_STEPS.reduce(
    (n, id) => n + (steps[id] ? 1 : 0),
    0,
  )
  const firstIncompleteStep =
    ONBOARDING_STEPS.find((id) => !steps[id]) ?? null

  return { steps, doneCount, firstIncompleteStep, completedAt }
}

/**
 * Lit l'état d'onboarding d'une org (admin client) et en dérive les étapes.
 * Ne renvoie jamais de valeur secrète, seulement des booléens + l'horodatage.
 */
export async function getOnboardingState(
  orgId: string,
): Promise<OnboardingState> {
  const { data } = await admin()
    .from('organizations')
    .select(
      'ringover_api_key, hubspot_token, hubspot_pipelines, hubspot_exit_criteria, onboarding_completed_at',
    )
    .eq('id', orgId)
    .maybeSingle()

  const pipelines = data?.hubspot_pipelines as unknown[] | null
  const criteria = data?.hubspot_exit_criteria as Record<
    string,
    unknown
  > | null

  return deriveSteps(
    {
      hasRingoverKey: hasSecret(data?.ringover_api_key),
      hasHubspotToken: hasSecret(data?.hubspot_token),
      // hubspot_pipelines : null = jamais synchronisé ; [] (improbable) = vide.
      hasPipelines: Array.isArray(pipelines) && pipelines.length > 0,
      // hubspot_exit_criteria : objet indexé par stageId ; non vide = au moins
      // une phase configurée.
      hasExitCriteria:
        criteria != null &&
        typeof criteria === 'object' &&
        Object.keys(criteria).length > 0,
    },
    (data?.onboarding_completed_at as string | null) ?? null,
  )
}
