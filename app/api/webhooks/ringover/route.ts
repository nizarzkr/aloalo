import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getRingoverCallRecording } from '@/lib/ringover'
import { decryptSecret } from '@/lib/crypto/org-secrets'
import {
  webhookLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'
import { RingoverWebhookSchema } from '@/lib/validations'
import { ingestRecording } from '@/lib/ingestion/ingest'
import type { NormalizedRecording, SimTranscript } from '@/lib/ingestion/types'

// ============================================================================
// ADAPTATEUR Ringover → couche d'ingestion commune (J41).
// ----------------------------------------------------------------------------
// Ce handler ne contient QUE le spécifique Ringover : vérif de signature HMAC,
// parsing/validation du payload, dérivation sûre de l'org, résolution de l'URL
// audio via l'API Ringover. Il traduit ensuite l'événement vers un
// `NormalizedRecording` et délègue tout le commun (insertion idempotente +
// déclenchement de la transcription) à `ingestRecording` (lib/ingestion/ingest.ts).
// ============================================================================

function verifySignature(body: string, signature: string, secret: string): boolean {
  // Fail closed : pas de secret configuré → on refuse tout (jamais d'open door).
  if (!secret) return false
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(signature, 'hex')
    // timingSafeEqual jette un RangeError sur des longueurs différentes : on
    // compare d'abord la longueur pour ne jamais lever (sinon → 500 → Ringover
    // retente une requête qui aurait dû être rejetée en 401).
    if (expectedBuf.length !== providedBuf.length) return false
    return crypto.timingSafeEqual(expectedBuf, providedBuf)
  } catch {
    // Signature malformée (hex invalide, etc.) → rejet propre (401), pas un 500.
    return false
  }
}

export async function POST(req: NextRequest) {
  // Rate limit — clé par IP. Volontairement avant la vérif HMAC pour absorber
  // un flood AVANT de payer le coût d'un Buffer.from + HMAC compute.
  const rl = await checkRateLimit(webhookLimiter, getClientKey(req))
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds)
  }

  // 1. Lire le body brut (nécessaire pour vérifier HMAC)
  const body = await req.text()
  const signature = req.headers.get('x-ringover-signature') ?? ''
  const secret = process.env.RINGOVER_WEBHOOK_SECRET ?? ''

  // 2. Vérifier la signature
  if (!signature || !verifySignature(body, signature, secret)) {
    console.error('[webhook/ringover] Signature invalide')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Parser le payload Ringover
  let rawPayload: unknown
  try {
    rawPayload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 3bis. Validation Zod du payload — on tolère les champs inconnus
  //       (passthrough) mais on vérifie la forme attendue.
  const parsed = RingoverWebhookSchema.safeParse(rawPayload)
  if (!parsed.success) {
    console.error('[webhook/ringover] payload invalide:', parsed.error.issues)
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 },
    )
  }
  const payload = parsed.data

  // 4. On ne traite que les événements de fin d'appel
  if (payload.event !== 'call.ended') {
    return NextResponse.json({ received: true })
  }

  // 5. Extraire les infos de l'appel (déjà validées par Zod)
  const call = payload.call

  // 6. Détecter le mode simulation.
  //    Le simulate-call injecte _sim_transcript dans l'objet call du payload.
  const simTranscriptRaw = call._sim_transcript ?? null

  const simTranscript: SimTranscript | null = simTranscriptRaw
    ? {
        text: simTranscriptRaw.text,
        segments: simTranscriptRaw.segments as SimTranscript['segments'],
        duration_seconds: call.duration as number,
        title: simTranscriptRaw.title,
      }
    : null

  // 7. Client admin (bypass RLS) — nécessaire pour dériver l'org d'un appel réel
  //    (pas de JWT user sur un webhook) et pour lire la clé API Ringover.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // 7bis. Dériver l'org de façon sûre.
  //   - Simulé : le simulateur est déjà authentifié (session dashboard) et
  //     fournit l'org_id de l'utilisateur connecté → on le garde.
  //   - Réel : on IGNORE le organization_id du body (non lié au signataire :
  //     qui détient le secret global pourrait écrire dans n'importe quelle org)
  //     et on dérive le tenant à partir de l'identifiant de compte Ringover de
  //     l'événement signé. Champ source (account_id) à confirmer au branchement
  //     réel de l'API Ringover (cf. migration 0021).
  let organizationId: string
  if (simTranscript) {
    organizationId = payload.organization_id
  } else {
    const ringoverAccountId = call.account_id ?? null
    if (!ringoverAccountId) {
      console.error('[webhook/ringover] call.account_id absent — org non dérivable')
      return NextResponse.json({ error: 'Unmapped Ringover account' }, { status: 422 })
    }
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('ringover_account_id', ringoverAccountId)
      .single()
    if (!org) {
      console.error('[webhook/ringover] Compte Ringover non rattaché à une org:', ringoverAccountId)
      return NextResponse.json({ error: 'Unmapped Ringover account' }, { status: 422 })
    }
    organizationId = org.id
  }

  // 8. Résoudre l'URL audio AVANT l'ingestion (pour qu'elle parte dans l'insert).
  //    On part de l'URL éventuellement fournie dans le payload, puis on retombe
  //    sur l'API Ringover si nécessaire (appel réel sans recording_url).
  //
  //    Décision archi 2026-05-13 : chaque client a sa propre clé API Ringover
  //    stockée chiffrée sur son organisation. On la lit ici (admin client, bypass
  //    RLS), on la déchiffre (issue #5) et on appelle /v2/calls/{id}/recording.
  let resolvedAudioUrl: string | null = (call.recording_url as string) ?? null

  if (!simTranscript && !resolvedAudioUrl) {
    const { data: org } = await supabase
      .from('organizations')
      .select('ringover_api_key')
      .eq('id', organizationId)
      .single()

    const apiKey = decryptSecret((org?.ringover_api_key as string | null) ?? null)
    if (apiKey) {
      resolvedAudioUrl = await getRingoverCallRecording(call.id as string, apiKey)
      if (!resolvedAudioUrl) {
        console.warn('[webhook/ringover] Pas de recording dispo via API pour', call.id)
      }
    } else {
      console.warn(
        '[webhook/ringover] Org sans ringover_api_key — recording non récupérable:',
        organizationId,
      )
    }
  }

  // 9. Traduire vers la forme normalisée commune.
  //    Identité CRM pré-câblée par le simulateur (démo / multi-contacts) : on la
  //    persiste telle quelle. Un `deal_id` commun regroupe plusieurs appels en un
  //    seul deal sur /dashboard/deals. Null en appel réel : c'est l'enrichissement
  //    HubSpot qui remplira ces colonnes plus tard.
  const recording: NormalizedRecording = {
    provider: simTranscript ? 'simulated' : 'ringover',
    providerCallId: call.id as string,
    organizationId,
    durationSeconds: (call.duration as number | undefined) ?? null,
    startedAt: (call.started_at as string | undefined) ?? null,
    calleeNumber: (call.to_number as string | undefined) ?? null,
    audioUrl: resolvedAudioUrl,
    // Rep propriétaire : fourni par le simulateur (user connecté). Null en appel
    // Ringover réel tant que le mapping agent→profile n'existe pas.
    userId: (call.user_id as string | null | undefined) ?? null,
    contactName: (simTranscriptRaw?.contact_name as string | null | undefined) ?? null,
    companyName: (simTranscriptRaw?.company_name as string | null | undefined) ?? null,
    dealName: (simTranscriptRaw?.deal_name as string | null | undefined) ?? null,
    dealId: (simTranscriptRaw?.deal_id as string | null | undefined) ?? null,
    simTranscript,
  }

  // 10. Déléguer le commun (insertion idempotente + déclenchement transcription).
  const result = await ingestRecording({ recording, triggerBaseUrl: req.url })

  if (result.outcome === 'duplicate') {
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (result.outcome === 'error') {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
