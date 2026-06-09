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
 *   🔒 FAIL CLOSED : en production, si HUBSPOT_APP_CLIENT_SECRET est absente, on
 *   refuse TOUT (401) — on ne sert jamais de données tenant sans vérifier la
 *   signature. Tolérance UNIQUEMENT hors prod (NODE_ENV !== 'production') pour
 *   itérer en local sans secret. La variable doit donc être posée dans TOUS les
 *   environnements Vercel (Production, Preview, Development).
 *
 * Query string (portalId est ajouté automatiquement par hubspot.fetch) :
 *   portalId  — Hub ID du portail HubSpot → identifie l'org Aloalo
 *   contactId — ID du contact HubSpot ouvert (carte sur fiche contact)
 *   dealId    — ID du deal HubSpot ouvert (carte sur fiche deal). Si présent,
 *               on renvoie le digest DU deal ; sinon le digest du contact.
 *
 * Réponse :
 *   - fiche contact : { lastScore, callCount, lastCallLabel, axe, lastCallId }
 *   - fiche deal    : { callCount, avgScore, lastScore, lastCallLabel, lastCallId }
 *   - état vide     : { message }
 *   Jamais de 500 (try/catch).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getContactCardData, getDealCardData } from '@/lib/hubspot-card'

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

// Vérifie la signature v3. Renvoie true si valide. Secret absent → fail closed
// en prod (401), toléré hors prod uniquement (voir en-tête du fichier).
function isAuthorized(req: NextRequest): boolean {
  const clientSecret = process.env.HUBSPOT_APP_CLIENT_SECRET
  if (!clientSecret) {
    // Fail closed : sans secret on ne sert AUCUNE donnée tenant en prod.
    // Tolérance dev uniquement (NODE_ENV !== 'production') pour itérer en local.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[hubspot/card-data] HUBSPOT_APP_CLIENT_SECRET absente — vérification de signature désactivée (DEV uniquement)',
      )
      return true
    }
    console.error(
      '[hubspot/card-data] HUBSPOT_APP_CLIENT_SECRET absente en production → 401 (fail closed)',
    )
    return false
  }

  const signature = req.headers.get('x-hubspot-signature-v3')
  const timestamp = req.headers.get('x-hubspot-request-timestamp')
  if (!signature || !timestamp) return false

  // Rejet si trop ancien (anti-rejeu).
  const age = Date.now() - Number(timestamp)
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_MS) return false

  // base = method + uri + body(vide en GET) + timestamp, HMAC-SHA256 base64.
  // ⚠️ HubSpot signe l'URI *décodée* (ex. `@` et non `%40` pour userEmail) — cf.
  // gotcha doc « decode %3A, %2F… before hashing ». On teste donc l'URL telle
  // que reçue ET sa version décodée, et on accepte si l'une des deux matche.
  const rawUrl = publicUrl(req)
  const candidates = new Set([rawUrl])
  try {
    candidates.add(decodeURIComponent(rawUrl))
  } catch {
    // decodeURIComponent peut throw sur une séquence % invalide → on ignore.
  }

  const sig = Buffer.from(signature)
  const matches = [...candidates].some((uri) => {
    const expected = createHmac('sha256', clientSecret)
      .update(`GET${uri}${timestamp}`, 'utf8')
      .digest('base64')
    const exp = Buffer.from(expected)
    return exp.length === sig.length && timingSafeEqual(exp, sig)
  })

  // Log minimal sans PII (l'URL contient userEmail → on ne la logue pas). Ne
  // devrait jamais arriver pour une vraie requête HubSpot.
  if (!matches) console.warn('[hubspot/card-data] signature v3 invalide → 401')

  return matches
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const portalId = params.get('portalId') ?? ''
  const contactId = params.get('contactId') ?? ''
  const dealId = params.get('dealId') ?? ''

  try {
    // Fiche deal → digest du deal ; sinon (fiche contact) → digest du contact.
    const result = dealId
      ? await getDealCardData({ portalId, dealId })
      : await getContactCardData({ portalId, contactId })
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
