/**
 * POST /api/transcribe
 *
 * Déclenche la transcription d'un appel "pending".
 * Appelé en fire-and-forget depuis le webhook Ringover juste après insertion du call.
 *
 * Body attendu :
 *   {
 *     callId: string
 *     audioUrl?: string          // mode réel : URL audio fraîchement résolue
 *                                // par le webhook (priorité sur calls.audio_url)
 *     simTranscript?: {          // présent uniquement en mode simulation
 *       text: string
 *       segments: TranscriptSegment[]
 *       duration_seconds: number
 *       title?: string
 *     }
 *   }
 *
 * Logique :
 *   - Si simTranscript présent → mode simulation (bypass AssemblyAI, coût 0)
 *   - Sinon → lance une vraie transcription AssemblyAI (async, complété via webhook)
 *
 * Status pipeline DB :
 *   pending → transcribing → transcribed (→ analyzed au J5)
 *   En cas d'erreur → failed
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { requestTranscription, estimateCostEur } from '@/lib/assemblyai'
import type { TranscriptSegment } from '@/lib/assemblyai'
import {
  apiLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'
import { verifyInternalSecret } from '@/lib/internal-auth'

type SimTranscript = {
  text: string
  segments: TranscriptSegment[]
  duration_seconds: number
  title?: string
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// Hôtes autorisés pour l'URL audio envoyée à AssemblyAI (garde anti-SSRF).
// Liste CSV de suffixes d'hôte via AUDIO_URL_ALLOWED_HOSTS ; défaut = Ringover.
// Ex : "ringover.com,cdn.ringover.com". On matche en suffixe (un suffixe
// "ringover.com" couvre "foo.ringover.com" ET "ringover.com" exactement).
function allowedAudioHosts(): string[] {
  return (process.env.AUDIO_URL_ALLOWED_HOSTS ?? 'ringover.com')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

function isAllowedAudioUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return allowedAudioHosts().some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    )
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // Rate limit — clé par IP.
  const rl = await checkRateLimit(apiLimiter, getClientKey(req))
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds)
  }

  // Secret partagé interne — cette route écrit avec la service key (bypass RLS)
  // et n'est appelée QUE par nos webhooks. Fail-closed si le secret est absent.
  if (!verifyInternalSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { callId?: string; audioUrl?: string; simTranscript?: SimTranscript }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { callId, audioUrl, simTranscript } = body
  if (!callId) {
    return NextResponse.json({ error: 'callId requis' }, { status: 400 })
  }

  // simTranscript est réservé à la simulation/dev. Jamais accepté en production,
  // même avec le secret interne valide (défense en profondeur : un secret fuité
  // ne doit pas permettre d'injecter un faux transcript).
  if (simTranscript && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'simTranscript interdit en production' },
      { status: 400 },
    )
  }

  const supabase = getAdminClient()

  // 1. Récupérer le call
  const { data: call, error: fetchError } = await supabase
    .from('calls')
    .select('id, organization_id, status, audio_url, duration_seconds')
    .eq('id', callId)
    .single()

  if (fetchError || !call) {
    console.error('[transcribe] Call introuvable:', callId, fetchError)
    return NextResponse.json({ error: 'Call introuvable' }, { status: 404 })
  }

  if (call.status !== 'pending') {
    // Déjà traité — on ignore
    return NextResponse.json({ skipped: true, status: call.status })
  }

  // ── MODE SIMULATION ────────────────────────────────────────────────────────
  if (simTranscript) {
    console.log('[transcribe] Mode simulation pour call:', callId)

    const { error: updateError } = await supabase
      .from('calls')
      .update({
        status: 'transcribed',
        transcript_text: simTranscript.text,
        transcript_segments: simTranscript.segments,
        // duration_seconds déjà rempli par le webhook Ringover
      })
      .eq('id', callId)

    if (updateError) {
      console.error('[transcribe] Erreur update simulation:', updateError)
      return NextResponse.json({ error: 'DB update error' }, { status: 500 })
    }

    // Logger coût 0 (simulation)
    await supabase.from('usage_logs').insert({
      organization_id: call.organization_id,
      call_id: callId,
      service: 'assemblyai',
      operation: 'transcription_simulation',
      cost_eur: 0,
      metadata: {
        mode: 'simulation',
        duration_seconds: simTranscript.duration_seconds,
        title: simTranscript.title,
      },
    })

    console.log('[transcribe] ✅ Simulation transcription OK, call:', callId)

    // Fire-and-forget vers /api/analyze. On utilise req.nextUrl.origin (l'host
    // qui traite la requête courante) plutôt que NEXT_PUBLIC_APP_URL :
    //   - en dev local → http://localhost:3000 (analyse traitée localement)
    //   - en prod Vercel → https://aloalo.vercel.app (analyse traitée en prod)
    // NEXT_PUBLIC_APP_URL pointe sur la prod et est réservé aux liens externes
    // (invitations email J8) — l'utiliser ici renverrait les requêtes dev vers
    // la prod, qui ne connaît pas le callId en question.
    const appUrl = req.nextUrl.origin
    // after() : on lance l'analyse APRÈS la réponse sans bloquer, et Vercel garde
    // la fonction vivante (un fetch fire-and-forget nu serait coupé au gel).
    after(async () => {
      try {
        const res = await fetch(`${appUrl}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-aloalo-internal': process.env.INTERNAL_PIPELINE_SECRET ?? '',
          },
          body: JSON.stringify({ callId }),
        })
        if (!res.ok) {
          throw new Error(`/api/analyze a répondu ${res.status}`)
        }
      } catch (err) {
        console.error('[transcribe] Erreur déclenchement /api/analyze:', err)
        Sentry.captureException(err, {
          tags: { route: '/api/transcribe', stage: 'trigger_analyze' },
          extra: { callId, organizationId: call.organization_id },
        })
      }
    })

    return NextResponse.json({ success: true, mode: 'simulation' })
  }

  // ── MODE RÉEL ──────────────────────────────────────────────────────────────
  // Priorité : audioUrl passé par le webhook (fraîchement résolu via API
  // Ringover) > valeur déjà stockée en DB (call.audio_url). On retombe sur la
  // DB pour les retries manuels où on relance /api/transcribe sans body.
  const effectiveAudioUrl = audioUrl ?? call.audio_url
  if (!effectiveAudioUrl) {
    const message = "Audio introuvable pour cet appel (pas d'URL audio à transcrire)."
    console.error('[transcribe] Pas d\'audio_url pour call:', callId)
    Sentry.captureException(new Error('transcribe: missing audio_url'), {
      tags: { route: '/api/transcribe', stage: 'audio_url' },
      extra: { callId, organizationId: call.organization_id },
    })
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: message })
      .eq('id', callId)
    return NextResponse.json({ error: 'Pas d\'audio_url' }, { status: 422 })
  }

  // Garde-fou SSRF : AssemblyAI va FETCHER cette URL. On exige https + un hôte
  // autorisé pour ne pas lui laisser suivre une URL arbitraire (SSRF aveugle,
  // exfiltration de budget). L'allowlist est configurable par env
  // (AUDIO_URL_ALLOWED_HOSTS, liste CSV de suffixes d'hôte) car l'hôte réel des
  // enregistrements Ringover (souvent un CDN/stockage) reste à confirmer au
  // premier vrai appel — on l'ajoute alors dans Vercel sans recoder. Défaut :
  // domaines Ringover connus.
  if (!isAllowedAudioUrl(effectiveAudioUrl)) {
    const message = "URL audio non autorisée : l'enregistrement provient d'un hôte non approuvé."
    console.error('[transcribe] audio_url non autorisée:', effectiveAudioUrl)
    Sentry.captureException(new Error('transcribe: audio_url not allowed'), {
      tags: { route: '/api/transcribe', stage: 'audio_url_allowlist' },
      extra: { callId, organizationId: call.organization_id },
    })
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: message })
      .eq('id', callId)
    return NextResponse.json({ error: 'audio_url non autorisée' }, { status: 422 })
  }

  // Passer en "transcribing"
  await supabase.from('calls').update({ status: 'transcribing' }).eq('id', callId)

  try {
    const transcriptId = await requestTranscription(effectiveAudioUrl)

    // AssemblyAI va notifier via webhook quand c'est fini.
    // On stocke le transcript_id dans une colonne dédiée indexée (issue #4) pour
    // que le webhook retrouve le call sans scanner la table.
    await supabase
      .from('calls')
      .update({ assemblyai_transcript_id: transcriptId })
      .eq('id', callId)

    // Logger coût estimé
    const estimatedCost = estimateCostEur(call.duration_seconds ?? 0)
    await supabase.from('usage_logs').insert({
      organization_id: call.organization_id,
      call_id: callId,
      service: 'assemblyai',
      operation: 'transcription_started',
      cost_eur: estimatedCost,
      metadata: { transcript_id: transcriptId, duration_seconds: call.duration_seconds },
    })

    console.log('[transcribe] ✅ Transcription lancée:', transcriptId, 'pour call:', callId)
    return NextResponse.json({ success: true, mode: 'real', transcriptId })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[transcribe] Erreur AssemblyAI:', message)
    Sentry.captureException(err, {
      tags: { route: '/api/transcribe', stage: 'assemblyai_request' },
      extra: { callId, organizationId: call.organization_id },
    })
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: `Transcription: ${message}` })
      .eq('id', callId)
    return NextResponse.json({ error: 'AssemblyAI error' }, { status: 500 })
  }
}
