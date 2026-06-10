/**
 * POST /api/webhooks/assemblyai
 *
 * AssemblyAI appelle cette URL quand une transcription est terminée.
 * On récupère le résultat, on met à jour le call en DB, on supprime l'audio (RGPD).
 *
 * Payload AssemblyAI :
 *   {
 *     transcript_id: string
 *     status: 'completed' | 'error'
 *     webhook_auth_header_name?: string
 *     webhook_auth_header_value?: string
 *   }
 *
 * Sécurité (issue #4) : on mirrore le durcissement du webhook Ringover.
 *   1. Rate limit par IP AVANT tout travail DB (absorbe un flood au plus tôt).
 *   2. Vérif d'un header secret partagé (x-assemblyai-webhook-secret) en temps
 *      constant — AssemblyAI le renvoie car requestTranscription le configure.
 *   3. Lookup du call par colonne indexée (plus de scan cross-tenant).
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import crypto from 'crypto'
import { getTranscriptionResult, normalizeSegments, estimateCostEur } from '@/lib/assemblyai'
import {
  webhookLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// Comparaison constante-temps du header d'auth envoyé par AssemblyAI.
// Les Buffers doivent avoir la même longueur pour timingSafeEqual.
function verifyWebhookSecret(received: string, expected: string): boolean {
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  // Rate limit AVANT tout travail DB — absorbe un flood au plus tôt.
  const rl = await checkRateLimit(webhookLimiter, getClientKey(req))
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds)
  }

  // Auth : AssemblyAI nous renvoie le header configuré à requestTranscription.
  const expectedSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET ?? ''
  const receivedSecret = req.headers.get('x-assemblyai-webhook-secret') ?? ''
  if (!expectedSecret || !verifyWebhookSecret(receivedSecret, expectedSecret)) {
    console.error('[webhook/assemblyai] Secret webhook invalide')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: { transcript_id?: string; status?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { transcript_id, status } = payload

  if (!transcript_id) {
    return NextResponse.json({ error: 'transcript_id manquant' }, { status: 400 })
  }

  console.log('[webhook/assemblyai] Notification reçue:', transcript_id, 'status:', status)

  const supabase = getAdminClient()

  // 1. Retrouver le call via la colonne indexée (plus de scan cross-tenant).
  const { data: call, error: fetchError } = await supabase
    .from('calls')
    .select('id, organization_id, duration_seconds, audio_url')
    .eq('assemblyai_transcript_id', transcript_id)
    .maybeSingle()

  if (fetchError) {
    console.error('[webhook/assemblyai] Erreur fetch call:', fetchError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!call) {
    // Peut arriver si le call a déjà été traité ou si c'est un webhook fantôme
    console.warn('[webhook/assemblyai] Aucun call trouvé pour transcript_id:', transcript_id)
    return NextResponse.json({ received: true })
  }

  // 2. Si AssemblyAI signale une erreur
  if (status === 'error') {
    const message = 'La transcription a échoué côté AssemblyAI (audio illisible ou trop court).'
    console.error('[webhook/assemblyai] Transcription en erreur:', transcript_id)
    Sentry.captureException(new Error(`assemblyai transcript error: ${transcript_id}`), {
      tags: { route: '/api/webhooks/assemblyai', stage: 'transcript_error' },
      extra: { transcript_id, callId: call.id, organizationId: call.organization_id },
    })
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: message })
      .eq('id', call.id)
    return NextResponse.json({ received: true })
  }

  // 3. Récupérer le résultat complet depuis l'API AssemblyAI
  let transcript
  try {
    transcript = await getTranscriptionResult(transcript_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[webhook/assemblyai] Erreur fetch transcript:', message)
    Sentry.captureException(err, {
      tags: { route: '/api/webhooks/assemblyai', stage: 'fetch_transcript' },
      extra: { transcript_id, callId: call.id, organizationId: call.organization_id },
    })
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: `Récupération transcription: ${message}` })
      .eq('id', call.id)
    return NextResponse.json({ error: 'AssemblyAI fetch error' }, { status: 500 })
  }

  if (transcript.status !== 'completed' || !transcript.text) {
    // Pas encore prêt — AssemblyAI a mal envoyé le webhook
    console.warn('[webhook/assemblyai] Transcript pas encore completed:', transcript.status)
    return NextResponse.json({ received: true })
  }

  // 4. Normaliser les segments (diarisation speaker A/B → notre format)
  const segments = normalizeSegments(transcript.utterances)

  // 5. Claim atomique transcribing → transcribed.
  //    AssemblyAI peut livrer le webhook 'completed' plusieurs fois. On ne met à
  //    jour QUE si le call est encore 'transcribing' : la première livraison gagne,
  //    les suivantes ne touchent aucune ligne et ne relancent ni le log de coût ni
  //    l'analyse.
  const { data: claimed, error: updateError } = await supabase
    .from('calls')
    .update({
      status: 'transcribed',
      transcript_text: transcript.text,
      transcript_segments: segments,
      // Supprimer l'URL audio (RGPD : on ne garde pas l'audio, juste le texte)
      audio_url: null,
    })
    .eq('id', call.id)
    .eq('status', 'transcribing')
    .select('id')

  if (updateError) {
    console.error('[webhook/assemblyai] Erreur update call:', updateError)
    // On ne flippe PAS le statut ici : l'update a échoué pour une raison
    // potentiellement transitoire (DB) et le call est encore 'transcribing'.
    // On capture juste l'incident pour diagnostic — le sweeper (#12) débloquera.
    Sentry.captureException(updateError, {
      tags: { route: '/api/webhooks/assemblyai', stage: 'db_update' },
      extra: { transcript_id, callId: call.id, organizationId: call.organization_id },
    })
    return NextResponse.json({ error: 'DB update error' }, { status: 500 })
  }

  if (!claimed || claimed.length === 0) {
    // Webhook dupliqué : le call est déjà passé transcribed. On accuse réception
    // sans relancer l'analyse ni relogger le coût.
    console.log('[webhook/assemblyai] Call déjà transcribed (webhook dupliqué), on ignore:', call.id)
    return NextResponse.json({ received: true })
  }

  // 6. Logger le coût réel (durée audio AssemblyAI)
  const durationSeconds = transcript.audio_duration ?? call.duration_seconds ?? 0
  const costEur = estimateCostEur(durationSeconds)

  await supabase.from('usage_logs').insert({
    organization_id: call.organization_id,
    call_id: call.id,
    service: 'assemblyai',
    operation: 'transcription_completed',
    cost_eur: costEur,
    metadata: {
      transcript_id,
      duration_seconds: durationSeconds,
      char_count: transcript.text.length,
    },
  })

  console.log('[webhook/assemblyai] ✅ Transcription OK pour call:', call.id, `(${durationSeconds}s, ${costEur}€)`)

  // 7. Déclencher l'analyse dans after()
  //    AssemblyAI a un timeout court (~10s) sur notre webhook ; l'analyse Claude
  //    peut prendre 5-15s. On répond 200 immédiatement et after() garde la
  //    fonction vivante pour que la requête /api/analyze parte réellement
  //    (un fetch fire-and-forget nu serait coupé au gel de la fonction).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  after(async () => {
    try {
      const res = await fetch(`${appUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-aloalo-internal': process.env.INTERNAL_PIPELINE_SECRET ?? '',
        },
        body: JSON.stringify({ callId: call.id }),
      })
      if (!res.ok) {
        throw new Error(`/api/analyze a répondu ${res.status}`)
      }
    } catch (err) {
      console.error('[webhook/assemblyai] Erreur déclenchement /api/analyze:', err)
      Sentry.captureException(err, {
        tags: { route: '/api/webhooks/assemblyai', stage: 'trigger_analyze' },
        extra: { callId: call.id, organizationId: call.organization_id },
      })
    }
  })

  return NextResponse.json({ received: true })
}
