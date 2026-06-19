// ============================================================================
// lib/crm/index.ts — Point d'entrée de l'abstraction CRM (J45).
// ============================================================================
// Les consommateurs (hygiène, momentum, phases, critères de sortie, forecast,
// push d'actions, carte) appellent `getCrmAdapter(orgId)` et parlent ensuite à
// l'interface CrmAdapter (cf. lib/crm/types.ts), sans jamais savoir QUEL CRM est
// branché derrière.
// ============================================================================

import { createHubspotAdapter } from '@/lib/crm/hubspot/adapter'
import type { CrmAdapter } from '@/lib/crm/types'

/**
 * Renvoie l'adaptateur du CRM connecté pour une org.
 *
 * J45 : HubSpot est le seul CRM connectable, donc on renvoie toujours son
 * adaptateur. L'adaptateur résout son jeton paresseusement : aucune lecture DB /
 * appel réseau ici, c'est immédiat.
 *
 * J46+ (Pipedrive / Salesforce) : c'est ICI qu'on détectera le provider
 * réellement connecté pour l'org (lecture DB d'une colonne `crm_provider`, ou
 * présence d'un jeton OAuth par provider) avant de choisir l'adaptateur — d'où la
 * signature asynchrone, déjà en place pour éviter de re-toucher tous les appelants.
 */
export function getCrmAdapter(orgId: string): Promise<CrmAdapter> {
  return Promise.resolve(createHubspotAdapter(orgId))
}

export { createHubspotAdapter } from '@/lib/crm/hubspot/adapter'
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
