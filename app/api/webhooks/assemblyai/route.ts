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
 * Sécurité : AssemblyAI permet de configurer un header d'auth custom.
 * Pour le MVP on vérifie juste que le transcript_id existe chez nous.
 * À renforcer au J13 (rate limiting + validation header).
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getTranscriptionResult, normalizeSegments, estimateCostEur } from '@/lib/assemblyai'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export async function POST(req: NextRequest) {
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

  // 1. Retrouver le call associé à ce transcript_id
  //    On l'a stocké dans transcript_segments (champ jsonb) en attendant la fin
  const { data: calls, error: fetchError } = await supabase
    .from('calls')
    .select('id, organization_id, duration_seconds, audio_url, transcript_segments')
    .eq('status', 'transcribing')

  if (fetchError) {
    console.error('[webhook/assemblyai] Erreur fetch calls:', fetchError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Trouver le call qui contient ce transcript_id dans ses segments
  const call = calls?.find(
    (c) =>
      typeof c.transcript_segments === 'object' &&
      (c.transcript_segments as Record<string, string>)?.assemblyai_transcript_id === transcript_id
  )

  if (!call) {
    // Peut arriver si le call a déjà été traité ou si c'est un webhook fantôme
    console.warn('[webhook/assemblyai] Aucun call trouvé pour transcript_id:', transcript_id)
    return NextResponse.json({ received: true })
  }

  // 2. Si AssemblyAI signale une erreur
  if (status === 'error') {
    await supabase
      .from('calls')
      .update({ status: 'failed' })
      .eq('id', call.id)
    console.error('[webhook/assemblyai] Transcription en erreur:', transcript_id)
    return NextResponse.json({ received: true })
  }

  // 3. Récupérer le résultat complet depuis l'API AssemblyAI
  let transcript
  try {
    transcript = await getTranscriptionResult(transcript_id)
  } catch (err) {
    console.error('[webhook/assemblyai] Erreur fetch transcript:', err)
    await supabase.from('calls').update({ status: 'failed' }).eq('id', call.id)
    return NextResponse.json({ error: 'AssemblyAI fetch error' }, { status: 500 })
  }

  if (transcript.status !== 'completed' || !transcript.text) {
    // Pas encore prêt — AssemblyAI a mal envoyé le webhook
    console.warn('[webhook/assemblyai] Transcript pas encore completed:', transcript.status)
    return NextResponse.json({ received: true })
  }

  // 4. Normaliser les segments (diarisation speaker A/B → notre format)
  const segments = normalizeSegments(transcript.utterances)

  // 5. Mettre à jour le call en DB
  const { error: updateError } = await supabase
    .from('calls')
    .update({
      status: 'transcribed',
      transcript_text: transcript.text,
      transcript_segments: segments,
      // Supprimer l'URL audio (RGPD : on ne garde pas l'audio, juste le texte)
      audio_url: null,
    })
    .eq('id', call.id)

  if (updateError) {
    console.error('[webhook/assemblyai] Erreur update call:', updateError)
    return NextResponse.json({ error: 'DB update error' }, { status: 500 })
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

  // 7. Fire-and-forget vers /api/analyze
  //    AssemblyAI a un timeout court (~10s) sur notre webhook ; l'analyse Claude
  //    peut prendre 5-15s. On répond 200 immédiatement et on lance l'analyse en arrière-plan.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${appUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callId: call.id }),
  }).catch((err) => {
    console.error('[webhook/assemblyai] Erreur fire-and-forget /api/analyze:', err)
  })

  return NextResponse.json({ received: true })
}
