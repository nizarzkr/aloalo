/**
 * GET /api/hubspot/card-data
 *
 * Source de données de la nouvelle App Card HubSpot (UI Extension React).
 * Appelé DIRECTEMENT par la carte React via `hubspot.fetch()` (cf.
 * hubspot/aloalo-crm-card/src/app/cards/AloaloCard.tsx). Plus de fonction
 * serverless HubSpot relais : celle-ci exigeait un abonnement Enterprise.
 *
 * AUTHENTIFICATION — signature HubSpot v3.
 *   hubspot.fetch ne transmet PAS de header custom (notre ancien secret partagé
 *   est donc impossible), MAIS signe chaque requête avec le CLIENT SECRET de
 *   l'app : header `X-HubSpot-Signature-v3` + `X-HubSpot-Request-Timestamp`.
 *   On reconstruit `method + url + body + timestamp`, on calcule le HMAC-SHA256
 *   (base64) avec le client secret, et on compare. Rien n'est exposé au
 *   navigateur (≠ carte classique publique, cf. project_hubspot_crm_card_unauth).
 *
 *   ⚠️ Dégradation douce MVP : tant que HUBSPOT_APP_CLIENT_SECRET n'est pas
 *   configurée, on LAISSE PASSER (en loguant un warning) pour pouvoir d'abord
 *   valider l'affichage de bout en bout. Dès que la variable est posée sur
 *   Vercel, la vérification devient obligatoire. À retirer (= rendre strict) au
 *   plus tard à la migration Public App + OAuth (1er client payant).
 *
 * Query string (portalId est ajouté automatiquement par hubspot.fetch) :
 *   portalId  — Hub ID du portail HubSpot → identifie l'org Aloalo
 *   contactId — ID du contact HubSpot ouvert
 *
 * Réponse : { lastScore, callCount, lastCallLabel, axe, lastCallId }
 *           ou { message } pour les états vides. Jamais de 500 (try/catch).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getContactCardData } from '@/lib/hubspot-card'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fenêtre anti-rejeu : HubSpot recommande de refuser au-delà de 5 minutes.
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000

// Reconstruit l'URL exacte qu'a signée HubSpot (URL publique Vercel, pas l'URL
// interne derrière le proxy). HubSpot signe scheme://host/path?query complet.
function publicUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`
}

// Vérifie la signature v3. Renvoie true si valide OU si la vérif est désactivée
// (secret non configuré → dégradation douce MVP, voir en-tête du fichier).
function isAuthorized(req: NextRequest): boolean {
  const clientSecret = process.env.HUBSPOT_APP_CLIENT_SECRET
  if (!clientSecret) {
    console.warn(
      '[hubspot/card-data] HUBSPOT_APP_CLIENT_SECRET absente — vérification de signature DÉSACTIVÉE (dégradation douce MVP)',
    )
    return true
  }

  const signature = req.headers.get('x-hubspot-signature-v3')
  const timestamp = req.headers.get('x-hubspot-request-timestamp')
  if (!signature || !timestamp) return false

  // Rejet si trop ancien (anti-rejeu).
  const age = Date.now() - Number(timestamp)
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_MS) return false

  // GET → corps vide. base = method + url + body + timestamp.
  const base = `GET${publicUrl(req)}${timestamp}`
  const expected = createHmac('sha256', clientSecret)
    .update(base, 'utf8')
    .digest('base64')

  // Comparaison à temps constant (évite le timing attack). Longueurs ≠ → faux.
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const portalId = params.get('portalId') ?? ''
  const contactId = params.get('contactId') ?? ''

  try {
    const result = await getContactCardData({ portalId, contactId })
    return NextResponse.json(result)
  } catch (err) {
    console.error(
      '[hubspot/card-data] erreur inattendue',
      err instanceof Error ? err.message : 'unknown',
    )
    Sentry.captureException(err, {
      tags: { route: '/api/hubspot/card-data' },
      extra: { portalId },
    })
    // On renvoie un message d'état plutôt qu'un 500 : la carte React l'affiche.
    return NextResponse.json({ message: 'Historique temporairement indisponible' })
  }
}
