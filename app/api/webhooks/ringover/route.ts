import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { getRingoverCallRecording } from '@/lib/ringover'
import { decryptSecret } from '@/lib/crypto/org-secrets'
import {
  webhookLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'
import { RingoverWebhookSchema } from '@/lib/validations'

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  // timingSafeEqual pour éviter les attaques par timing
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
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
  const organizationId = payload.organization_id

  // 6. Détecter le mode simulation
  //    Le simulate-call injecte _sim_transcript dans l'objet call du payload
  const simTranscriptRaw = call._sim_transcript ?? null

  const simTranscript = simTranscriptRaw
    ? {
        text: simTranscriptRaw.text,
        segments: simTranscriptRaw.segments as Array<{
          speaker: string
          text: string
          start: number
          end: number
        }>,
        duration_seconds: call.duration as number,
        title: simTranscriptRaw.title,
      }
    : null

  // 7. Insérer en base avec le client admin (bypass RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // Identité CRM pré-câblée par le simulateur (démo / multi-contacts) : on la
  // persiste telle quelle. Un `deal_id` commun regroupe plusieurs appels (et
  // contacts) en un seul deal sur /dashboard/deals. Null en appel réel : c'est
  // l'enrichissement HubSpot qui remplira ces colonnes plus tard.
  const simIdentity = simTranscriptRaw
    ? {
        contact_name: (simTranscriptRaw.contact_name as string | null) ?? null,
        company_name: (simTranscriptRaw.company_name as string | null) ?? null,
        deal_name: (simTranscriptRaw.deal_name as string | null) ?? null,
        deal_id: (simTranscriptRaw.deal_id as string | null) ?? null,
      }
    : null

  const { data: insertedCall, error } = await supabase
    .from('calls')
    .insert({
      organization_id: organizationId,
      provider: simTranscript ? 'simulated' : 'ringover',
      provider_call_id: call.id as string,
      callee_number: call.to_number as string,
      duration_seconds: call.duration as number,
      audio_url: (call.recording_url as string) ?? null,
      status: 'pending',
      started_at: call.started_at as string,
      ...(simIdentity?.contact_name ? { contact_name: simIdentity.contact_name } : {}),
      ...(simIdentity?.company_name ? { company_name: simIdentity.company_name } : {}),
      ...(simIdentity?.deal_name ? { deal_name: simIdentity.deal_name } : {}),
      ...(simIdentity?.deal_id ? { deal_id: simIdentity.deal_id } : {}),
    })
    .select('id')
    .single()

  if (error || !insertedCall) {
    console.error('[webhook/ringover] Erreur insertion:', error)
    Sentry.captureException(error ?? new Error('calls insert returned no row'), {
      tags: { route: '/api/webhooks/ringover', stage: 'db_insert_call' },
      extra: {
        organizationId,
        ringoverCallId: call.id,
        eventType: payload.event,
      },
    })
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  console.log('[webhook/ringover] Appel inséré ✅', call.id, '→ DB id:', insertedCall.id)

  // 8. Récupérer l'URL audio via l'API Ringover si :
  //    - on n'est pas en mode simulation (sinon on a déjà le transcript)
  //    - et l'URL n'était pas déjà fournie dans le payload du webhook
  //
  //    Décision archi 2026-05-13 : chaque client a sa propre clé API
  //    Ringover stockée sur son organisation. On la lit ici (admin client,
  //    bypass RLS) pour appeler /v2/calls/{id}/recording.
  let resolvedAudioUrl: string | null = (call.recording_url as string) ?? null

  if (!simTranscript && !resolvedAudioUrl) {
    const { data: org } = await supabase
      .from('organizations')
      .select('ringover_api_key')
      .eq('id', organizationId)
      .single()

    // Clé stockée chiffrée au repos (issue #5) → déchiffrement avant usage.
    const apiKey = decryptSecret((org?.ringover_api_key as string | null) ?? null)
    if (apiKey) {
      resolvedAudioUrl = await getRingoverCallRecording(call.id as string, apiKey)
      if (resolvedAudioUrl) {
        // On reflète l'URL dans la ligne calls pour traçabilité / retry.
        await supabase
          .from('calls')
          .update({ audio_url: resolvedAudioUrl })
          .eq('id', insertedCall.id)
      } else {
        console.warn('[webhook/ringover] Pas de recording dispo via API pour', call.id)
      }
    } else {
      console.warn(
        '[webhook/ringover] Org sans ringover_api_key — recording non récupérable:',
        organizationId,
      )
    }
  }

  // 9. Déclencher la transcription en fire-and-forget
  //    On ne bloque pas la réponse Ringover sur le résultat de la transcription
  const transcribeUrl = new URL('/api/transcribe', req.url).toString()
  fetch(transcribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callId: insertedCall.id,
      ...(simTranscript ? { simTranscript } : {}),
      // Passé uniquement en mode réel : /api/transcribe utilise audioUrl si
      // présent, sinon retombe sur la valeur stockée en DB (audio_url).
      ...(resolvedAudioUrl && !simTranscript ? { audioUrl: resolvedAudioUrl } : {}),
    }),
  }).catch((err) => {
    console.error('[webhook/ringover] Erreur déclenchement transcription:', err)
    Sentry.captureException(err, {
      tags: { route: '/api/webhooks/ringover', stage: 'trigger_transcribe' },
      extra: { callId: insertedCall.id, organizationId },
    })
  })

  return NextResponse.json({ received: true })
}
