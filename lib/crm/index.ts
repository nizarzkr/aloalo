// ============================================================================
// lib/crm/index.ts — Point d'entrée de l'abstraction CRM (J45).
// ============================================================================
// Les consommateurs (hygiène, momentum, phases, critères de sortie, forecast,
// push d'actions, carte) appellent `getCrmAdapter(orgId)` et parlent ensuite à
// l'interface CrmAdapter (cf. lib/crm/types.ts), sans jamais savoir QUEL CRM est
// branché derrière.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

import { createHubspotAdapter } from '@/lib/crm/hubspot/adapter'
import { createPipedriveAdapter } from '@/lib/crm/pipedrive/adapter'
import type { CrmAdapter, CrmProvider } from '@/lib/crm/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Renvoie l'adaptateur du CRM piloté par une org.
 *
 * Aiguillage sur la colonne `organizations.crm_provider` (J46) :
 *   - 'pipedrive' → adaptateur Pipedrive ;
 *   - défaut ('hubspot' ou valeur inconnue) → adaptateur HubSpot.
 *
 * Le défaut 'hubspot' (cf. migration 0036) garantit ZÉRO changement de
 * comportement pour les orgs existantes. Chaque adaptateur résout ensuite son
 * jeton paresseusement (aucun appel CRM ici, juste un select PK).
 */
export async function getCrmAdapter(orgId: string): Promise<CrmAdapter> {
  const { data } = await admin()
    .from('organizations')
    .select('crm_provider')
    .eq('id', orgId)
    .maybeSingle()

  const provider = (data?.crm_provider as CrmProvider | null) ?? 'hubspot'
  if (provider === 'pipedrive') return createPipedriveAdapter(orgId)
  return createHubspotAdapter(orgId)
}

export { createHubspotAdapter } from '@/lib/crm/hubspot/adapter'
export { createPipedriveAdapter } from '@/lib/crm/pipedrive/adapter'
export type {
  CrmAdapter,
  CrmProvider,
  CrmContact,
  CrmContactDetails,
  CrmCompany,
  CrmDeal,
  CrmDealCall,
  CrmWonDeal,
  CrmEmailSignals,
  CrmContactContext,
  CrmPipeline,
  CrmPipelineStage,
  CrmStoredPipelines,
  CrmPipelineSyncResult,
  CrmTarget,
  CrmConnectionStatus,
  CrmAnalysisSummary,
} from '@/lib/crm/types'
