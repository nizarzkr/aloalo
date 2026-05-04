import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

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
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 4. On ne traite que les événements de fin d'appel
  if (payload.event !== 'call.ended') {
    return NextResponse.json({ received: true })
  }

  // 5. Extraire les infos de l'appel
  const call = payload.call as Record<string, unknown>
  const organizationId = payload.organization_id as string

  // 6. Détecter le mode simulation
  //    Le simulate-call injecte _sim_transcript dans l'objet call du payload
  const simTranscriptRaw = call._sim_transcript as {
    text: string
    segments: Array<{ speaker: string; text: string; start: number; end: number }>
    mock_id?: string
    title?: string
  } | null

  const simTranscript = simTranscriptRaw
    ? {
        text: simTranscriptRaw.text,
        segments: simTranscriptRaw.segments,
        duration_seconds: call.duration as number,
        title: simTranscriptRaw.title,
      }
    : null

  // 7. Insérer en base avec le client admin (bypass RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

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
    })
    .select('id')
    .single()

  if (error || !insertedCall) {
    console.error('[webhook/ringover] Erreur insertion:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  console.log('[webhook/ringover] Appel inséré ✅', call.id, '→ DB id:', insertedCall.id)

  // 8. Déclencher la transcription en fire-and-forget
  //    On ne bloque pas la réponse Ringover sur le résultat de la transcription
  const transcribeUrl = new URL('/api/transcribe', req.url).toString()
  fetch(transcribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callId: insertedCall.id,
      ...(simTranscript ? { simTranscript } : {}),
    }),
  }).catch((err) => {
    console.error('[webhook/ringover] Erreur déclenchement transcription:', err)
  })

  return NextResponse.json({ received: true })
}
