/**
 * GET /api/hubspot/crm-card
 *
 * ⚠️ CARTE CLASSIQUE HubSpot — DÉPRÉCIÉE. Support arrêté depuis le 16 juin 2025,
 * sunset total le 31 octobre 2026. Remplacée par l'App Card React (UI Extension)
 * dont les données viennent de /api/hubspot/card-data. On conserve cette route
 * tant que la nouvelle App Card n'est pas validée en prod, puis on la retirera.
 *
 * Endpoint PUBLIC appelé par HubSpot à chaque ouverture d'une fiche contact.
 * HubSpot affiche le JSON renvoyé sous forme d'une « CRM Card » (carte "Avant
 * RDV") dans la colonne latérale de la fiche.
 *
 * Query string envoyée par HubSpot :
 *   associatedObjectId   — ID de l'objet ouvert (contact)
 *   associatedObjectType — 'CONTACT' | 'DEAL' | ...
 *   portalId             — Hub ID du portail HubSpot appelant
 *
 * Sécurité : endpoint NON authentifié (HubSpot n'envoie pas notre JWT). On
 * identifie l'org uniquement via portalId. Le nouvel endpoint /card-data, lui,
 * est protégé par secret partagé. En cas d'erreur inattendue on dégrade vers une
 * carte vide — jamais de 500, sinon HubSpot affiche une erreur dans la fiche.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getContactCardData, isCardMessage } from '@/lib/hubspot-card'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Base URL pour les liens IFRAME vers le dashboard Aloalo. On privilégie la
// variable d'env (utilisée partout dans l'app) avec repli sur l'URL prod.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aloalo-three.vercel.app'

// ----------------------------------------------------------------------------
// Carte "message seul" — utilisée pour tous les états vides (portail non
// configuré, pas de téléphone, aucun appel). On renvoie une vraie carte plutôt
// qu'un `results: []` : un tableau vide n'affiche AUCUN texte côté HubSpot.
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

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const associatedObjectId = params.get('associatedObjectId') ?? ''
  const associatedObjectType = params.get('associatedObjectType') ?? ''
  const portalId = params.get('portalId') ?? ''

  // objectId doit être numérique côté HubSpot et égaler associatedObjectId.
  const objectId = Number.parseInt(associatedObjectId, 10) || 0

  try {
    // On ne gère que les fiches CONTACT (les deals viendront plus tard).
    if (portalId && associatedObjectType && associatedObjectType !== 'CONTACT') {
      return messageCard(
        objectId,
        'Ouvrez une fiche contact pour voir l’historique Aloalo',
      )
    }

    const result = await getContactCardData({
      portalId,
      contactId: associatedObjectId,
    })

    if (isCardMessage(result)) {
      return messageCard(objectId, result.message)
    }

    return NextResponse.json({
      results: [
        {
          objectId,
          title: 'Historique Aloalo',
          properties: [
            {
              label: 'Dernier score',
              dataType: 'STRING',
              value: result.lastScore != null ? `${result.lastScore}/100` : '—',
            },
            {
              label: "Nb d'appels analysés",
              dataType: 'STRING',
              value: String(result.callCount),
            },
            {
              label: 'Dernier appel',
              dataType: 'STRING',
              value: result.lastCallLabel,
            },
            { label: 'Axe prioritaire', dataType: 'STRING', value: result.axe },
          ],
          actions: [
            {
              type: 'IFRAME',
              width: 890,
              height: 748,
              uri: `${APP_URL}/dashboard/calls/${result.lastCallId}`,
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
