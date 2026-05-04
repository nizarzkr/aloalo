import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { MOCK_TRANSCRIPTS } from '@/lib/dev/mock-transcripts'

// Sécurité : cet endpoint ne fonctionne qu'en développement
if (process.env.NODE_ENV === 'production') {
  console.warn('[dev/simulate-call] Tentative d\'accès en production bloquée')
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const secret = process.env.RINGOVER_WEBHOOK_SECRET ?? ''
  if (!secret) {
    return NextResponse.json({ error: 'RINGOVER_WEBHOOK_SECRET manquant' }, { status: 500 })
  }

  // Choisir un transcript aléatoire (ou un index passé en body)
  const body = await req.json().catch(() => ({}))
  const transcriptIndex = typeof body.transcriptIndex === 'number'
    ? body.transcriptIndex
    : Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)

  const transcript = MOCK_TRANSCRIPTS[transcriptIndex]

  // Récupérer l'organization_id du premier utilisateur en base
  // (en dev on a forcément un seul user inscrit — nous)
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Aucune organisation trouvée. Inscris-toi d\'abord.' }, { status: 404 })
  }

  // Forger le payload Ringover (format réel de leur API)
  const fakePayload = {
    event: 'call.ended',
    organization_id: org.id,
    call: {
      id: `sim_${Date.now()}`,
      from_number: transcript.caller_number,
      to_number: transcript.callee_number,
      duration: transcript.duration_seconds,
      recording_url: null, // Pas d'audio en simulation
      started_at: new Date(Date.now() - transcript.duration_seconds * 1000).toISOString(),
      // On glisse le transcript dans les metadata pour le récupérer au J4
      _sim_transcript: {
        text: transcript.text,
        segments: transcript.segments,
        mock_id: transcript.id,
        title: transcript.title,
      }
    }
  }

  const payloadString = JSON.stringify(fakePayload)

  // Calculer la signature HMAC exactement comme le ferait Ringover
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex')

  // Envoyer la requête à notre propre webhook
  const webhookUrl = new URL('/api/webhooks/ringover', req.url).toString()
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ringover-signature': signature,
    },
    body: payloadString,
  })

  const result = await response.json()

  return NextResponse.json({
    success: response.ok,
    transcript_used: transcript.title,
    webhook_status: response.status,
    webhook_response: result,
  })
}
