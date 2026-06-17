// ============================================================================
// lib/hubspot-pipelines.ts — Synchro + lecture de la carte du tunnel (J27)
// ============================================================================
// Socle #3 (1/3) de la Semaine 4 : Aloalo lit et stocke la STRUCTURE du tunnel
// HubSpot de chaque org (pipelines + stages), pas seulement le stage courant
// d'un deal. C'est le pré-requis des exit-criteria (J28), de l'onboarding (J29)
// et de l'hygiène de pipeline (J30).
//
// Stockage : colonne jsonb `organizations.hubspot_pipelines` (+ `_synced_at`),
// décision tranchée avec Nizar (cf. migration 0025). On lit/écrit le tunnel d'un
// bloc — pas de table relationnelle.
//
// Réutilisé par :
//   - `updateHubspotSettings` (auto à la connexion réussie) ;
//   - `refreshHubspotPipelines` (bouton « Rafraîchir le tunnel »).
//
// Robuste : un échec de lecture HubSpot N'ÉCRASE PAS une carte déjà stockée
// (on ne remplace que si on a vraiment récupéré des pipelines).
// ============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'

import { getDealPipelines, type HubspotPipeline } from '@/lib/hubspot'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

export type PipelineSyncResult = {
  ok: boolean
  pipelineCount: number
  stageCount: number
}

/**
 * Lit le tunnel HubSpot d'une org et le persiste (instantané + horodatage).
 * @returns un résumé (nb de pipelines/stages). `ok:false` si rien n'a pu être
 * lu (token invalide, HubSpot injoignable) — dans ce cas la carte existante
 * n'est PAS écrasée.
 */
export async function syncOrgPipelines(
  orgId: string,
  token: string | null,
): Promise<PipelineSyncResult> {
  const empty: PipelineSyncResult = { ok: false, pipelineCount: 0, stageCount: 0 }
  if (!orgId || !token) return empty

  const pipelines = await getDealPipelines(token)
  // Un portail a TOUJOURS au moins le pipeline « default ». 0 → lecture échouée :
  // on n'écrase pas une carte déjà en base par du vide.
  if (pipelines.length === 0) return empty

  const { error } = await admin()
    .from('organizations')
    .update({
      hubspot_pipelines: pipelines,
      hubspot_pipelines_synced_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    console.error('[hubspot-pipelines] persistance échouée', error.message)
    return empty
  }

  return {
    ok: true,
    pipelineCount: pipelines.length,
    stageCount: pipelines.reduce((n, p) => n + p.stages.length, 0),
  }
}

export type OrgPipelines = {
  pipelines: HubspotPipeline[]
  syncedAt: string | null
}

/**
 * Lit la carte du tunnel déjà stockée pour une org (aucun appel HubSpot).
 * Sert à l'affichage (page Intégrations) et, plus tard, aux couches d'analyse.
 */
export async function getOrgPipelines(orgId: string): Promise<OrgPipelines> {
  const { data } = await admin()
    .from('organizations')
    .select('hubspot_pipelines, hubspot_pipelines_synced_at')
    .eq('id', orgId)
    .maybeSingle()

  return {
    pipelines: (data?.hubspot_pipelines as HubspotPipeline[] | null) ?? [],
    syncedAt: (data?.hubspot_pipelines_synced_at as string | null) ?? null,
  }
}
