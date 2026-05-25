/**
 * GET /api/hubspot/crm-card
 *
 * Endpoint PUBLIC appelé par HubSpot à chaque ouverture d'une fiche contact
 * (ou deal) dans le CRM du client. HubSpot affiche le JSON renvoyé sous forme
 * d'une « CRM Card » dans la colonne latérale de la fiche (carte "Avant RDV").
 *
 * Query string envoyée par HubSpot :
 *   associatedObjectId   — ID de l'objet ouvert (contact ou deal)
 *   associatedObjectType — 'CONTACT' | 'DEAL' | ...
 *   portalId             — Hub ID du portail HubSpot appelant
 *   userId, userEmail    — utilisateur HubSpot qui consulte (non utilisé ici)
 *
 * Logique :
 *   1. portalId → org Aloalo (organizations.hubspot_portal_id)
 *   2. org absente → carte "Portail non configuré dans Aloalo"
 *   3. type CONTACT → lit le téléphone du contact côté HubSpot (getContact)
 *   4. téléphone → 5 derniers appels analysés de ce contact (calls + analyses)
 *   5. renvoie le payload CRM Card v2
 *
 * Sécurité : endpoint NON authentifié (HubSpot n'envoie pas notre JWT). On
 * identifie l'org uniquement via portalId. Durcissement prévu : validation de
 * la signature `X-HubSpot-Signature` v3 (cf. brief J16, section sécurité). En
 * cas d'erreur inattendue on dégrade vers une carte vide — jamais de 500, sinon
 * HubSpot affiche une erreur disgracieuse dans la fiche.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getContact } from '@/lib/hubspot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Base URL pour les liens IFRAME vers le dashboard Aloalo. On privilégie la
// variable d'env (utilisée partout dans l'app) avec repli sur l'URL prod.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aloalo-three.vercel.app'

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

// ----------------------------------------------------------------------------
// Carte "message seul" — utilisée pour tous les états vides (portail non
// configuré, pas de téléphone, aucun appel). On renvoie une vraie carte plutôt
// qu'un `results: []` : un tableau vide n'affiche AUCUN texte côté HubSpot,
// alors qu'ici on veut expliquer pourquoi il n'y a rien à montrer.
// ----------------------------------------------------------------------------
function messageCard(objectId: number, message: string) {
  return NextResponse.json({
    results: [
      {
        objectId,
        title: 'Historique Aloalo',
        properties: [{ label: 'Statut', dataType: 'STRING', value: message }],
      },
    ],
  })
}

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

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const associatedObjectId = params.get('associatedObjectId') ?? ''
  const associatedObjectType = params.get('associatedObjectType') ?? ''
  const portalId = params.get('portalId') ?? ''

  // objectId doit être numérique côté HubSpot et égaler associatedObjectId.
  const objectId = Number.parseInt(associatedObjectId, 10) || 0

  try {
    if (!portalId) {
      return messageCard(objectId, 'Portail non configuré dans Aloalo')
    }

    const supabase = getAdminClient()

    // 1. portalId → org Aloalo
    const { data: org } = await supabase
      .from('organizations')
      .select('id, hubspot_token')
      .eq('hubspot_portal_id', portalId)
      .limit(1)
      .maybeSingle()

    if (!org) {
      return messageCard(objectId, 'Portail non configuré dans Aloalo')
    }

    // Pour l'instant on ne gère que les fiches CONTACT (les deals viendront
    // plus tard : il faudrait remonter du deal vers ses contacts associés).
    if (associatedObjectType !== 'CONTACT') {
      return messageCard(
        objectId,
        'Ouvrez une fiche contact pour voir l’historique Aloalo',
      )
    }

    if (!org.hubspot_token) {
      return messageCard(objectId, 'Connexion HubSpot incomplète côté Aloalo')
    }

    // 3. Lire le téléphone du contact côté HubSpot
    const contact = await getContact(associatedObjectId, org.hubspot_token)
    const phones = [contact?.phone, contact?.mobilephone].filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0,
    )

    if (phones.length === 0) {
      return messageCard(objectId, 'Aucun numéro de téléphone sur ce contact')
    }

    // 4. 5 derniers appels analysés de ce contact.
    //    `analyses!inner` = jointure stricte → on ne ramène que les appels qui
    //    ONT une analyse. `count: 'exact'` renvoie le total (peut dépasser 5).
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
      return messageCard(objectId, 'Aucun appel analysé pour ce contact')
    }

    // 5. Construire la carte à partir du dernier appel analysé.
    const first = rows[0] as {
      id: string
      started_at: string | null
      created_at: string
      analyses: unknown
    }
    const lastAnalysis = pickAnalysis(first.analyses)

    const lastScore = lastAnalysis?.score_global ?? null
    const lastCallRaw = first.started_at ?? first.created_at
    const lastCallLabel = lastCallRaw
      ? DATE_FMT.format(new Date(lastCallRaw))
      : '—'

    return NextResponse.json({
      results: [
        {
          objectId,
          title: 'Historique Aloalo',
          properties: [
            {
              label: 'Dernier score',
              dataType: 'STRING',
              value: lastScore != null ? `${lastScore}/100` : '—',
            },
            {
              label: "Nb d'appels analysés",
              dataType: 'STRING',
              value: String(count ?? rows.length),
            },
            { label: 'Dernier appel', dataType: 'STRING', value: lastCallLabel },
            {
              label: 'Axe prioritaire',
              dataType: 'STRING',
              value: pickAxe(lastAnalysis),
            },
          ],
          actions: [
            {
              type: 'IFRAME',
              width: 890,
              height: 748,
              uri: `${APP_URL}/dashboard/calls/${first.id}`,
              label: 'Voir le détail sur Aloalo',
            },
          ],
        },
      ],
    })
  } catch (err) {
    // On ne renvoie jamais de 500 à HubSpot : on dégrade vers une carte vide.
    console.error(
      '[hubspot/crm-card] erreur inattendue',
      err instanceof Error ? err.message : 'unknown',
    )
    Sentry.captureException(err, {
      tags: { route: '/api/hubspot/crm-card' },
      extra: { portalId, associatedObjectType },
    })
    return messageCard(objectId, 'Historique temporairement indisponible')
  }
}
