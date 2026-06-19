// ============================================================================
// lib/hubspot-sync.ts — Enrichissement HubSpot d'un appel (J18bis).
// ============================================================================
// Résout le numéro d'un appel vers le CRM HubSpot (contact + entreprise + deal
// le plus récent) et écrit ces infos d'affichage sur la ligne `calls`. Partagé
// entre :
//   - /api/analyze (bloc after, automatique sur chaque nouvel appel) ;
//   - /api/calls/[id]/hubspot-refresh (bouton « Rafraîchir depuis HubSpot »).
//
// Ne pousse PAS de note/tâche : c'est uniquement l'enrichissement d'affichage.
// (Les notes/tâches restent gérées dans /api/analyze pour éviter les doublons
// à chaque rafraîchissement.)
//
// Tout est dégradé : si HubSpot ne répond pas, les champs restent null et on
// renvoie un contexte vide — jamais d'exception qui remonte.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrmAdapter, CrmContactContext } from '@/lib/crm/types'

// Compose un nom lisible « Prénom Nom » à partir du contact HubSpot, ou null
// si aucun des deux champs n'est renseigné (on retombera sur le numéro).
function formatContactName(
  firstname: string | null,
  lastname: string | null,
): string | null {
  const name = [firstname, lastname].filter(Boolean).join(' ').trim()
  return name.length > 0 ? name : null
}

/**
 * Résout le contexte HubSpot d'un appel par son numéro et écrit les colonnes
 * d'affichage (contact_name, company_name, deal_name, deal_id, hubspot_contact_id,
 * hubspot_enriched_at). Renvoie le contexte résolu pour que l'appelant puisse
 * réutiliser le deal/contact (ex. cibler les notes/tâches) sans re-requêter.
 *
 * @returns CrmContactContext (contact/company/deal, chacun pouvant être null).
 */
export async function enrichCallFromHubspot(
  supabase: SupabaseClient,
  callId: string,
  phone: string | null,
  crm: CrmAdapter,
): Promise<CrmContactContext> {
  const empty: CrmContactContext = { contact: null, company: null, deal: null }
  if (!phone) return empty

  // resolveContactContext dégrade vers un contexte vide si le CRM n'est pas
  // connecté ou si le numéro n'a pas de contact → on n'écrase alors rien.
  const ctx = await crm.resolveContactContext(phone)
  if (!ctx.contact) return ctx

  const contactName = formatContactName(
    ctx.contact.firstname,
    ctx.contact.lastname,
  )

  const { error } = await supabase
    .from('calls')
    .update({
      // On ne remplace le nom que si HubSpot en a un (sinon on garde l'existant).
      ...(contactName ? { contact_name: contactName } : {}),
      company_name: ctx.company?.name ?? null,
      deal_name: ctx.deal?.dealname ?? null,
      deal_id: ctx.deal?.id ?? null,
      // Phase du deal (J25 phase 2) → vrai gagné/perdu pour les pipelines standard.
      deal_stage: ctx.deal?.dealstage ?? null,
      hubspot_contact_id: ctx.contact.id,
      hubspot_enriched_at: new Date().toISOString(),
    })
    .eq('id', callId)

  if (error) {
    console.error('[hubspot-sync] update enrichissement échoué', error.message)
  }

  return ctx
}
