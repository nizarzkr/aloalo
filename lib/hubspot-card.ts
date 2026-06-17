// ============================================================================
// lib/hubspot-card.ts — Données de la carte HubSpot "Historique Aloalo".
// ============================================================================
// Logique consommée par l'endpoint app/api/hubspot/card-data/route.ts, appelé
// DIRECTEMENT par l'App Card React (UI Extension) via hubspot.fetch(), auth par
// signature HubSpot v3. (La carte classique a été retirée — voir issue #3.)
//
// On a extrait cette logique pour qu'un seul endroit fasse : portalId → org →
// téléphone du contact → derniers appels analysés. L'endpoint se contente
// ensuite de FORMATER le résultat (JSON propre pour l'App Card).
//
// Renvoie soit des données (`CardData`), soit un message d'état vide
// (`{ message }`) — jamais d'exception métier (les erreurs réseau HubSpot sont
// déjà absorbées par lib/hubspot.ts). L'appelant gère le cas message → carte
// "message seul".
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import { getContact, getDealCalls } from '@/lib/hubspot'
import { decryptSecret } from '@/lib/crypto/org-secrets'
import { summarizeDimensions } from '@/lib/metrics/dimensions-summary'

// Données affichables de la carte (dernier appel analysé du contact).
// Depuis J25, on n'expose plus de score /100 : on montre le nb de dimensions
// validées (validé/partiel/manqué) du dernier appel, dans le même langage que
// l'app. `lastTotal` = nb de dimensions présentes (normalement 5).
export type CardData = {
  lastValidated: number | null
  lastTotal: number | null
  callCount: number
  lastCallLabel: string
  axe: string
  lastCallId: string
}

// Données affichables de la carte DEAL : digest des appels rattachés à CE deal.
// `avgValidated` = santé du dossier en dimensions validées moyennes (sur 5).
export type DealCardData = {
  callCount: number
  avgValidated: number | null
  lastValidated: number | null
  lastTotal: number | null
  lastCallLabel: string
  lastCallId: string
}

// Soit des données, soit un message expliquant pourquoi il n'y a rien à montrer.
// Un type par surface pour que l'appelant garde un narrowing précis (la carte
// contact n'a pas `avgScore`, la carte deal n'a pas `axe`).
export type ContactCardResult = CardData | { message: string }
export type DealCardResult = DealCardData | { message: string }

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
  dimensions: unknown
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
}): Promise<ContactCardResult> {
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
  // Token stocké chiffré au repos (issue #5) → déchiffrement avant usage.
  const hubspotToken = decryptSecret(org.hubspot_token)
  if (!hubspotToken) {
    return { message: 'Connexion HubSpot incomplète côté Aloalo' }
  }
  if (!contactId) {
    return { message: 'Ouvrez une fiche contact pour voir l’historique Aloalo' }
  }

  // 2. Lire le téléphone du contact côté HubSpot (phone OU mobilephone).
  const contact = await getContact(contactId, hubspotToken)
  const phones = [contact?.phone, contact?.mobilephone].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  )

  if (phones.length === 0) {
    return { message: 'Aucun numéro de téléphone sur ce contact' }
  }

  // 3. 5 derniers appels analysés de ce contact.
  //    `analyses!inner` = jointure stricte → seuls les appels qui ONT une
  //    analyse. `count: 'exact'` renvoie le total réel (peut dépasser 5).
  //    NB : le numéro de l'appel est dans `callee_number` (seule colonne
  //    téléphone de `calls`). Match exact pour l'instant — voir TODO E.164.
  const { data: rows, count } = await supabase
    .from('calls')
    .select(
      'id, started_at, created_at, analyses!inner(dimensions, weaknesses, coaching_advice)',
      { count: 'exact' },
    )
    .eq('organization_id', org.id)
    .in('callee_number', phones)
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
  const lastSummary = summarizeDimensions(lastAnalysis?.dimensions)

  return {
    lastValidated: lastSummary?.validated ?? null,
    lastTotal: lastSummary?.total ?? null,
    callCount: count ?? rows.length,
    lastCallLabel: lastCallRaw ? DATE_FMT.format(new Date(lastCallRaw)) : '—',
    axe: pickAxe(lastAnalysis),
    lastCallId: first.id,
  }
}

// Tolérance de jointure appel HubSpot ↔ appel Aloalo : même numéro ET horaires
// à moins de 2 min d'écart. Faute de clé d'ID partagée (hs_call_external_id non
// exposé), on s'appuie sur (numéro + horodatage). 2 min absorbe le décalage
// d'horloge Ringover↔HubSpot sans risquer de confondre deux appels distincts.
const MATCH_WINDOW_MS = 2 * 60 * 1000

// Forme d'un appel Aloalo candidat lu pour le matching deal.
type AloaloCallRow = {
  id: string
  callee_number: string | null
  started_at: string | null
  created_at: string
  analyses: unknown
}

// Instant de référence d'un appel Aloalo (started_at, sinon created_at).
function callMs(row: AloaloCallRow): number {
  const raw = row.started_at ?? row.created_at
  const ms = raw ? Date.parse(raw) : NaN
  return Number.isFinite(ms) ? ms : NaN
}

// ----------------------------------------------------------------------------
// getDealCardData — digest des appels analysés rattachés à UN deal.
//   portalId : Hub ID du portail HubSpot appelant → identifie l'org Aloalo.
//   dealId   : ID du deal HubSpot ouvert.
// On lit les appels que HubSpot associe au deal, puis on les relie aux appels
// Aloalo par (numéro appelé + horodatage). C'est HubSpot qui tranche quels
// appels appartiennent au deal — d'où la précision même quand un contact a
// plusieurs deals.
// ----------------------------------------------------------------------------
export async function getDealCardData({
  portalId,
  dealId,
}: {
  portalId: string
  dealId: string
}): Promise<DealCardResult> {
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
  // Token stocké chiffré au repos (issue #5) → déchiffrement avant usage.
  const hubspotToken = decryptSecret(org.hubspot_token)
  if (!hubspotToken) {
    return { message: 'Connexion HubSpot incomplète côté Aloalo' }
  }
  if (!dealId) {
    return { message: 'Ouvrez une fiche deal pour voir le digest Aloalo' }
  }

  // 2. Appels que HubSpot rattache à ce deal (numéro appelé + horodatage).
  const dealCalls = await getDealCalls(dealId, hubspotToken)
  const numbers = [
    ...new Set(
      dealCalls
        .map((c) => c.toNumber)
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0),
    ),
  ]
  if (numbers.length === 0) {
    return { message: 'Aucun appel analysé sur ce deal' }
  }

  // 3. Appels Aloalo candidats : mêmes numéros, avec analyse (jointure stricte).
  const { data: rows } = await supabase
    .from('calls')
    .select(
      'id, callee_number, started_at, created_at, analyses!inner(dimensions)',
    )
    .eq('organization_id', org.id)
    .in('callee_number', numbers)
    .order('started_at', { ascending: false, nullsFirst: false })

  const candidates = (rows ?? []) as AloaloCallRow[]
  if (candidates.length === 0) {
    return { message: 'Aucun appel analysé sur ce deal' }
  }

  // 4. Matcher chaque appel HubSpot au plus proche appel Aloalo (même numéro,
  //    écart d'horaire ≤ fenêtre), sans réutiliser deux fois le même appel.
  const usedAloalo = new Set<string>()
  const matched: Array<{
    id: string
    validated: number | null
    total: number | null
    ms: number
  }> = []

  for (const hc of dealCalls) {
    if (!hc.toNumber || hc.timestampMs == null) continue
    let best: AloaloCallRow | null = null
    let bestDelta = Infinity
    for (const row of candidates) {
      if (usedAloalo.has(row.id)) continue
      if (row.callee_number !== hc.toNumber) continue
      const ms = callMs(row)
      if (!Number.isFinite(ms)) continue
      const delta = Math.abs(ms - hc.timestampMs)
      if (delta <= MATCH_WINDOW_MS && delta < bestDelta) {
        best = row
        bestDelta = delta
      }
    }
    if (best) {
      usedAloalo.add(best.id)
      const summary = summarizeDimensions(pickAnalysis(best.analyses)?.dimensions)
      matched.push({
        id: best.id,
        validated: summary?.validated ?? null,
        total: summary?.total ?? null,
        ms: callMs(best),
      })
    }
  }

  if (matched.length === 0) {
    return { message: 'Aucun appel analysé sur ce deal' }
  }

  // 5. Agréger : moyenne des dimensions validées + dernier appel (le plus récent).
  const validatedVals = matched
    .map((m) => m.validated)
    .filter((v): v is number => typeof v === 'number')
  const avgValidated =
    validatedVals.length > 0
      ? Math.round(
          (validatedVals.reduce((a, b) => a + b, 0) / validatedVals.length) * 10,
        ) / 10
      : null

  const last = matched.reduce((a, b) => (b.ms > a.ms ? b : a))

  return {
    callCount: matched.length,
    avgValidated,
    lastValidated: last.validated,
    lastTotal: last.total,
    lastCallLabel: Number.isFinite(last.ms)
      ? DATE_FMT.format(new Date(last.ms))
      : '—',
    lastCallId: last.id,
  }
}
