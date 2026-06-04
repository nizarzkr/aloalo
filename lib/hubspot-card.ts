// ============================================================================
// lib/hubspot-card.ts — Données de la carte HubSpot "Historique Aloalo".
// ============================================================================
// Logique partagée entre :
//   - la carte CLASSIQUE (app/api/hubspot/crm-card/route.ts) — dépréciée par
//     HubSpot, sunset le 31 oct. 2026 ;
//   - le nouvel endpoint (app/api/hubspot/card-data/route.ts) appelé DIRECTEMENT
//     par l'App Card React (UI Extension) via hubspot.fetch(), auth par signature
//     HubSpot v3.
//
// On a extrait cette logique pour qu'un seul endroit fasse : portalId → org →
// téléphone du contact → derniers appels analysés. Les deux surfaces ci-dessus
// se contentent ensuite de FORMATER le résultat (payload CRM Card v2 pour la
// carte classique, JSON propre pour l'App Card).
//
// Renvoie soit des données (`CardData`), soit un message d'état vide
// (`{ message }`) — jamais d'exception métier (les erreurs réseau HubSpot sont
// déjà absorbées par lib/hubspot.ts). L'appelant gère le cas message → carte
// "message seul".
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import { getContact } from '@/lib/hubspot'

// Données affichables de la carte (dernier appel analysé du contact).
export type CardData = {
  lastScore: number | null
  callCount: number
  lastCallLabel: string
  axe: string
  lastCallId: string
}

// Soit des données, soit un message expliquant pourquoi il n'y a rien à montrer.
export type CardResult = CardData | { message: string }

// Garde de type pratique pour l'appelant.
export function isCardMessage(r: CardResult): r is { message: string } {
  return 'message' in r
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

// Format français des dates ("23 mai 2026").
const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Forme partielle d'une analyse telle qu'on la lit ici (jsonb non typé en DB).
type AnalysisRow = {
  score_global: number | null
  weaknesses: Array<{ point?: string }> | null
  coaching_advice: Array<{ advice?: string; priority?: string }> | null
}

// PostgREST renvoie l'embed `analyses` soit en objet (relation 1-1, grâce à la
// contrainte unique sur call_id) soit en tableau selon l'inférence. On normalise.
function pickAnalysis(embed: unknown): AnalysisRow | null {
  const obj = Array.isArray(embed) ? embed[0] : embed
  return (obj ?? null) as AnalysisRow | null
}

// "Axe prioritaire" = principal point à travailler. On prend la 1re faiblesse
// (libellé court, ex. "Gestion des objections"), à défaut le conseil de
// coaching le plus prioritaire.
function pickAxe(a: AnalysisRow | null): string {
  if (!a) return '—'

  const weaknesses = Array.isArray(a.weaknesses) ? a.weaknesses : []
  if (weaknesses[0]?.point) return weaknesses[0].point

  const advices = Array.isArray(a.coaching_advice) ? a.coaching_advice : []
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const sorted = [...advices].sort(
    (x, y) => (order[x.priority ?? ''] ?? 3) - (order[y.priority ?? ''] ?? 3),
  )
  if (sorted[0]?.advice) return sorted[0].advice

  return '—'
}

// ----------------------------------------------------------------------------
// getContactCardData — cœur de la carte.
//   portalId  : Hub ID du portail HubSpot appelant → identifie l'org Aloalo.
//   contactId : ID du contact HubSpot ouvert → on en lit le téléphone.
// ----------------------------------------------------------------------------
export async function getContactCardData({
  portalId,
  contactId,
}: {
  portalId: string
  contactId: string
}): Promise<CardResult> {
  if (!portalId) return { message: 'Portail non configuré dans Aloalo' }

  const supabase = getAdminClient()

  // 1. portalId → org Aloalo
  const { data: org } = await supabase
    .from('organizations')
    .select('id, hubspot_token')
    .eq('hubspot_portal_id', portalId)
    .limit(1)
    .maybeSingle()

  if (!org) return { message: 'Portail non configuré dans Aloalo' }
  if (!org.hubspot_token) {
    return { message: 'Connexion HubSpot incomplète côté Aloalo' }
  }
  if (!contactId) {
    return { message: 'Ouvrez une fiche contact pour voir l’historique Aloalo' }
  }

  // 2. Lire le téléphone du contact côté HubSpot (phone OU mobilephone).
  const contact = await getContact(contactId, org.hubspot_token)
  const phones = [contact?.phone, contact?.mobilephone].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  )

  if (phones.length === 0) {
    return { message: 'Aucun numéro de téléphone sur ce contact' }
  }

  // 3. 5 derniers appels analysés de ce contact.
  //    `analyses!inner` = jointure stricte → seuls les appels qui ONT une
  //    analyse. `count: 'exact'` renvoie le total réel (peut dépasser 5).
  const { data: rows, count } = await supabase
    .from('calls')
    .select(
      'id, started_at, created_at, analyses!inner(score_global, weaknesses, coaching_advice)',
      { count: 'exact' },
    )
    .eq('organization_id', org.id)
    .in('contact_phone', phones)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(5)

  if (!rows || rows.length === 0) {
    return { message: 'Aucun appel analysé pour ce contact' }
  }

  // 4. Construire les données à partir du dernier appel analysé.
  const first = rows[0] as {
    id: string
    started_at: string | null
    created_at: string
    analyses: unknown
  }
  const lastAnalysis = pickAnalysis(first.analyses)
  const lastCallRaw = first.started_at ?? first.created_at

  return {
    lastScore: lastAnalysis?.score_global ?? null,
    callCount: count ?? rows.length,
    lastCallLabel: lastCallRaw ? DATE_FMT.format(new Date(lastCallRaw)) : '—',
    axe: pickAxe(lastAnalysis),
    lastCallId: first.id,
  }
}
