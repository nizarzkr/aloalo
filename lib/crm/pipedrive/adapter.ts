// ============================================================================
// lib/crm/pipedrive/adapter.ts — Adaptateur CRM Pipedrive (J46).
// ============================================================================
// 2ᵉ implémentation de l'interface CrmAdapter (cf. lib/crm/types.ts), preuve que
// l'abstraction J45 tient. Pur CÂBLAGE vers lib/pipedrive.ts ; aucune logique
// métier ici. Même patron que l'adaptateur HubSpot (lib/crm/hubspot/adapter.ts),
// à une différence près : Pipedrive a besoin du COUPLE { token, apiDomain } (base
// d'URL propre à la société), résolu paresseusement + mémoïsé via
// getPipedriveContext — on ne paie le déchiffrement/refresh qu'à la 1re méthode
// « live », et une seule fois.
//
// getStoredPipelines lit l'instantané de tunnel stocké (colonne hubspot_pipelines,
// provider-agnostique) → réutilise getOrgPipelines, sans contexte Pipedrive.
// ============================================================================

import * as pd from "@/lib/pipedrive";
import { getPipedriveContext, type PipedriveContext } from "@/lib/pipedrive-oauth";
import {
  getOrgPipelines,
  persistOrgPipelines,
  type PipelineSyncResult,
} from "@/lib/hubspot-pipelines";
import type { CrmAdapter } from "@/lib/crm/types";

export function createPipedriveAdapter(orgId: string): CrmAdapter {
  // Contexte (token + apiDomain) mémoïsé : créé à la 1re méthode « live ».
  let ctxPromise: Promise<PipedriveContext | null> | undefined;
  const ctx = () => (ctxPromise ??= getPipedriveContext(orgId));

  return {
    provider: "pipedrive",

    async isConnected() {
      return Boolean(await ctx());
    },

    // --- Lectures live (dégradent si non connecté : c === null) ---
    async searchContactByPhone(phone) {
      const c = await ctx();
      return c ? pd.searchPersonByPhone(c.apiDomain, c.token, phone) : null;
    },
    async getContact(contactId) {
      const c = await ctx();
      return c ? pd.getPerson(c.apiDomain, c.token, contactId) : null;
    },
    async getContactCompany(contactId) {
      const c = await ctx();
      return c ? pd.getPersonOrganization(c.apiDomain, c.token, contactId) : null;
    },
    async getMostRecentDealForContact(contactId) {
      const c = await ctx();
      return c ? pd.getMostRecentDealForPerson(c.apiDomain, c.token, contactId) : null;
    },
    async resolveContactContext(phone) {
      const c = await ctx();
      return c
        ? pd.resolvePersonContext(c.apiDomain, c.token, phone)
        : { contact: null, company: null, deal: null };
    },
    async getDeal(dealId) {
      const c = await ctx();
      return c ? pd.getDeal(c.apiDomain, c.token, dealId) : null;
    },
    async getDealCalls() {
      // Dégradé J46 (cf. lib/pipedrive.getDealCalls).
      return pd.getDealCalls();
    },
    async getContactEmailSignals() {
      // Dégradé J46 (cf. lib/pipedrive.getPersonEmailSignals).
      return pd.getPersonEmailSignals();
    },
    async getRecentWonDeals(limit) {
      const c = await ctx();
      return c ? pd.getRecentWonDeals(c.apiDomain, c.token, limit) : [];
    },
    async testConnection() {
      const c = await ctx();
      return c ? pd.testConnection(c.apiDomain, c.token) : "invalid";
    },

    // --- Carte du tunnel ---
    getStoredPipelines() {
      return getOrgPipelines(orgId);
    },
    async syncPipelines(): Promise<PipelineSyncResult> {
      const c = await ctx();
      if (!c) return { ok: false, pipelineCount: 0, stageCount: 0 };
      const pipelines = await pd.getPipelinesAndStages(c.apiDomain, c.token);
      return persistOrgPipelines(orgId, pipelines);
    },

    // --- Écritures ---
    async createNote(target, content) {
      const c = await ctx();
      return c ? pd.createNote(c.apiDomain, c.token, target, content) : null;
    },
    async createTask(target, title, dueDateMs, body) {
      const c = await ctx();
      return c
        ? pd.createTask(c.apiDomain, c.token, target, title, dueDateMs, body)
        : null;
    },
    async createTimelineEvent(contactId, analysis) {
      return pd.createTimelineEvent(contactId, analysis);
    },
  };
}
