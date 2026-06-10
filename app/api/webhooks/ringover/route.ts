import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
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

  // 7. Client admin (bypass RLS) — nécessaire dès maintenant pour dériver l'org
  //    d'un appel réel (pas de JWT user sur un webhook), puis pour l'insert.
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

  // Idempotence (issue #8) : un retry/replay signé du même call.ended réel ne
  // doit pas créer de doublon ni re-déclencher une transcription payante. On
  // upsert sur (organization_id, provider_call_id) en ignorant les conflits.
  // L'index unique est partiel (where provider <> 'simulated') → les appels
  // simulés gardent leur comportement « toujours insérer » (ids non uniques).
  const { data: insertedCall, error } = await supabase
    .from('calls')
    .upsert(
      {
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
      },
      { onConflict: 'organization_id,provider_call_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  // Conflit (replay) → ignoreDuplicates renvoie 0 ligne sans erreur : on s'arrête
  // AVANT de re-déclencher la transcription.
  if (!error && !insertedCall) {
    console.log('[webhook/ringover] Replay ignoré pour', call.id)
    return NextResponse.json({ received: true, duplicate: true })
  }

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

  // 9. Déclencher la transcription dans after() : exécuté APRÈS l'envoi de la
  //    réponse Ringover, mais Vercel garde la fonction vivante jusqu'au bout —
  //    un fetch fire-and-forget nu pourrait être coupé avant de partir (gel serverless).
  const transcribeUrl = new URL('/api/transcribe', req.url).toString()
  after(async () => {
    try {
      const res = await fetch(transcribeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-aloalo-internal': process.env.INTERNAL_PIPELINE_SECRET ?? '',
        },
        body: JSON.stringify({
          callId: insertedCall.id,
          ...(simTranscript ? { simTranscript } : {}),
          // Passé uniquement en mode réel : /api/transcribe utilise audioUrl si
          // présent, sinon retombe sur la valeur stockée en DB (audio_url).
          ...(resolvedAudioUrl && !simTranscript ? { audioUrl: resolvedAudioUrl } : {}),
        }),
      })
      if (!res.ok) {
        throw new Error(`/api/transcribe a répondu ${res.status}`)
      }
    } catch (err) {
      console.error('[webhook/ringover] Erreur déclenchement transcription:', err)
      Sentry.captureException(err, {
        tags: { route: '/api/webhooks/ringover', stage: 'trigger_transcribe' },
        extra: { callId: insertedCall.id, organizationId },
      })
    }
  })

  return NextResponse.json({ received: true })
}
