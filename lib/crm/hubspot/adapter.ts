// ============================================================================
// lib/crm/hubspot/adapter.ts — Adaptateur CRM HubSpot (J45).
// ============================================================================
// Première implémentation de l'interface CrmAdapter (cf. lib/crm/types.ts).
// Pur CÂBLAGE : chaque méthode délègue à la fonction homonyme de lib/hubspot.ts /
// lib/hubspot-pipelines.ts en injectant le jeton requis. AUCUNE logique métier
// ici — toute la logique HubSpot (requêtes, dégradation, formats) reste dans
// lib/hubspot*.ts, qui devient un détail interne de cet adaptateur.
//
// Résolution PARESSEUSE + MÉMOÏSÉE du jeton : `getStoredPipelines` est une simple
// lecture DB qui n'a pas besoin de jeton ; on ne paie donc `getHubspotToken`
// (lecture DB + rafraîchissement OAuth éventuel) QUE si une méthode « live » est
// appelée, et UNE SEULE fois par adaptateur (plusieurs écritures successives —
// ex. resolveTarget + createTask — réutilisent le même jeton, sans rafraîchir 2x).
// ============================================================================

import * as hs from '@/lib/hubspot'
import { getHubspotToken } from '@/lib/hubspot-oauth'
import { getOrgPipelines, syncOrgPipelines } from '@/lib/hubspot-pipelines'
import type { CrmAdapter } from '@/lib/crm/types'

export function createHubspotAdapter(orgId: string): CrmAdapter {
  // Promesse de jeton mémoïsée : créée à la 1re méthode « live » qui en a besoin.
  let tokenPromise: Promise<string | null> | undefined
  const token = () => (tokenPromise ??= getHubspotToken(orgId))

  // Les fonctions lib/hubspot.ts gardent toutes `if (!token) return <dégradé>`,
  // donc passer la chaîne vide quand le jeton est absent reproduit exactement le
  // comportement « non connecté → null/[] » sans brancher partout.
  const tok = async () => (await token()) ?? ''

  return {
    provider: 'hubspot',

    async isConnected() {
      return Boolean(await token())
    },

    // --- Lectures live ---
    async searchContactByPhone(phone) {
      return hs.searchContactByPhone(phone, await tok())
    },
    async getContact(contactId) {
      return hs.getContact(contactId, await tok())
    },
    async getContactCompany(contactId) {
      return hs.getContactCompany(contactId, await tok())
    },
    async getMostRecentDealForContact(contactId) {
      return hs.getMostRecentDealForContact(contactId, await tok())
    },
    async resolveContactContext(phone) {
      return hs.resolveContactContext(phone, await tok())
    },
    async getDeal(dealId) {
      return hs.getDeal(dealId, await tok())
    },
    async getDealCalls(dealId) {
      return hs.getDealCalls(dealId, await tok())
    },
    async getContactEmailSignals(contactId) {
      return hs.getContactEmailSignals(contactId, await tok())
    },
    async getRecentWonDeals(limit) {
      return hs.getRecentWonDeals(await tok(), limit)
    },
    async testConnection() {
      return hs.testHubspotConnection(await tok())
    },

    // --- Carte du tunnel ---
    // Lecture de l'instantané stocké : pas de jeton (lecture DB pure).
    getStoredPipelines() {
      return getOrgPipelines(orgId)
    },
    async syncPipelines() {
      return syncOrgPipelines(orgId, await token())
    },

    // --- Écritures ---
    async createNote(target, content) {
      return hs.createNote(target, content, await tok())
    },
    async createTask(target, title, dueDateMs, body) {
      return hs.createTask(target, title, dueDateMs, await tok(), body)
    },
    async createTimelineEvent(contactId, analysis) {
      return hs.createTimelineEvent(contactId, analysis, await tok())
    },
  }
}
