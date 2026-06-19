// ============================================================================
// lib/crm/types.ts — Contrat normalisé d'accès au CRM (J45).
// ============================================================================
// Socle de l'abstraction « CRM » (Phase D). Jusqu'ici toute l'intelligence
// commerciale (hygiène, momentum, phases du tunnel, critères de sortie, forecast,
// push d'actions, carte) parlait DIRECTEMENT à HubSpot via lib/hubspot*.ts. Pour
// accueillir Pipedrive (J46) puis Salesforce (J47) sans dupliquer cette logique,
// on insère une interface `CrmAdapter` : le code « cerveau » parle à l'interface,
// un ADAPTATEUR par CRM (lib/crm/<provider>/) traduit vers l'API du provider.
//
// Même mouvement que l'abstraction d'ingestion J41 (cf. lib/ingestion/types.ts) :
// un contrat unique en amont, des adaptateurs minces en aval.
//
// IMPORTANT : ce fichier ne fait QUE réexporter, sous des noms génériques, les
// types de données déjà définis dans lib/hubspot.ts (la première implémentation).
// Le flux de dépendances va crm → hubspot, jamais l'inverse : lib/hubspot.ts ne
// doit JAMAIS importer lib/crm (sinon cycle).
// ============================================================================

import type {
  HubspotContact,
  HubspotContactDetails,
  HubspotCompany,
  HubspotDeal,
  HubspotDealCall,
  HubspotWonDeal,
  DealCrmEmailSignals,
  ContactContext,
  HubspotPipeline,
  HubspotPipelineStage,
  HubspotTarget,
  HubspotConnectionStatus,
} from '@/lib/hubspot'
import type { OrgPipelines, PipelineSyncResult } from '@/lib/hubspot-pipelines'

// CRM supportés. Seul 'hubspot' est implémenté en J45 ; les deux autres sont
// déclarés ici pour que l'interface les accueille (impl J46/J47).
export type CrmProvider = 'hubspot' | 'pipedrive' | 'salesforce'

// --- Types de données, neutres vis-à-vis du CRM ----------------------------
// Alias des types HubSpot (forme déjà minimale/normalisée, cf. lib/hubspot.ts).
// Un futur adaptateur Pipedrive/Salesforce mappera SA réponse vers ces formes.
export type CrmContact = HubspotContact
export type CrmContactDetails = HubspotContactDetails
export type CrmCompany = HubspotCompany
export type CrmDeal = HubspotDeal
export type CrmDealCall = HubspotDealCall
export type CrmWonDeal = HubspotWonDeal
export type CrmEmailSignals = DealCrmEmailSignals
export type CrmContactContext = ContactContext
export type CrmPipeline = HubspotPipeline
export type CrmPipelineStage = HubspotPipelineStage
export type CrmStoredPipelines = OrgPipelines
export type CrmPipelineSyncResult = PipelineSyncResult
export type CrmTarget = HubspotTarget
export type CrmConnectionStatus = HubspotConnectionStatus

// Résumé d'analyse poussé sur la timeline CRM (forme attendue par createTimelineEvent).
export type CrmAnalysisSummary = {
  score: number
  strengths: string[]
  improvements: string[]
}

// ============================================================================
// L'interface CRM. Un adaptateur est TOUJOURS lié à une org (il résout lui-même
// le jeton d'accès du CRM connecté de cette org — le `token` n'apparaît JAMAIS
// dans les signatures, contrairement aux fonctions lib/hubspot.ts brutes).
//
// Robustesse héritée de lib/hubspot.ts : aucune méthode ne throw ; elles
// dégradent vers null / [] / un résultat vide si le CRM est injoignable ou non
// connecté.
// ============================================================================
export interface CrmAdapter {
  // CRM sous-jacent (pour les logs / l'affichage « CRM connecté »).
  readonly provider: CrmProvider

  // True si une connexion exploitable existe (jeton résolu). Résout le jeton à la
  // première invocation puis le mémoïse (cf. adaptateur).
  isConnected(): Promise<boolean>

  // --- Lectures « live » (appellent l'API du CRM) ---
  searchContactByPhone(phone: string): Promise<CrmContact | null>
  getContact(contactId: string): Promise<CrmContactDetails | null>
  getContactCompany(contactId: string): Promise<CrmCompany | null>
  getMostRecentDealForContact(contactId: string): Promise<CrmDeal | null>
  resolveContactContext(phone: string): Promise<CrmContactContext>
  getDeal(dealId: string): Promise<CrmDeal | null>
  getDealCalls(dealId: string): Promise<CrmDealCall[]>
  getContactEmailSignals(contactId: string): Promise<CrmEmailSignals | null>
  getRecentWonDeals(limit?: number): Promise<CrmWonDeal[]>
  testConnection(): Promise<CrmConnectionStatus>

  // --- Carte du tunnel ---
  // Lecture de l'instantané déjà STOCKÉ par Aloalo (lecture DB, sans appel CRM ni
  // jeton). Synchro = relit l'API du CRM et persiste l'instantané.
  getStoredPipelines(): Promise<CrmStoredPipelines>
  syncPipelines(): Promise<CrmPipelineSyncResult>

  // --- Écritures ---
  createNote(target: CrmTarget, content: string): Promise<string | null>
  createTask(
    target: CrmTarget,
    title: string,
    dueDateMs: number,
    body?: string,
  ): Promise<string | null>
  createTimelineEvent(
    contactId: string,
    analysis: CrmAnalysisSummary,
  ): Promise<boolean>
}
