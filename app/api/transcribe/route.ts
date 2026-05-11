/**
 * POST /api/transcribe
 *
 * Déclenche la transcription d'un appel "pending".
 * Appelé en fire-and-forget depuis le webhook Ringover juste après insertion du call.
 *
 * Body attendu :
 *   {
 *     callId: string
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
import { NextRequest, NextResponse } from 'next/server'
import { requestTranscription, estimateCostEur } from '@/lib/assemblyai'
import type { TranscriptSegment } from '@/lib/assemblyai'

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

export async function POST(req: NextRequest) {
  let body: { callId?: string; simTranscript?: SimTranscript }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { callId, simTranscript } = body
  if (!callId) {
    return NextResponse.json({ error: 'callId requis' }, { status: 400 })
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
    fetch(`${appUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId }),
    }).catch((err) => {
      console.error('[transcribe] Erreur fire-and-forget /api/analyze:', err)
    })

    return NextResponse.json({ success: true, mode: 'simulation' })
  }

  // ── MODE RÉEL ──────────────────────────────────────────────────────────────
  if (!call.audio_url) {
    console.error('[transcribe] Pas d\'audio_url pour call:', callId)
    await supabase.from('calls').update({ status: 'failed' }).eq('id', callId)
    return NextResponse.json({ error: 'Pas d\'audio_url' }, { status: 422 })
  }

  // Passer en "transcribing"
  await supabase.from('calls').update({ status: 'transcribing' }).eq('id', callId)

  try {
    const transcriptId = await requestTranscription(call.audio_url)

    // AssemblyAI va notifier via webhook quand c'est fini.
    // On note le transcript_id dans les segments (champ libre jsonb) pour retrouver l'appel.
    await supabase
      .from('calls')
      .update({
        transcript_segments: { assemblyai_transcript_id: transcriptId },
      })
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
    console.error('[transcribe] Erreur AssemblyAI:', err)
    await supabase.from('calls').update({ status: 'failed' }).eq('id', callId)
    return NextResponse.json({ error: 'AssemblyAI error' }, { status: 500 })
  }
}
