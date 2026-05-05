import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { MOCK_TRANSCRIPTS } from '@/lib/dev/mock-transcripts'
import { createClient } from '@/lib/supabase/server'

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

  // L'appel simulé est rattaché à l'org de l'utilisateur connecté (cookie de session).
  // Avant : on prenait la première org en DB → multi-comptes en dev = collision possible.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Tu dois être connecté pour simuler un appel.' },
      { status: 401 },
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return NextResponse.json(
      { error: 'Profil sans organisation — inscris-toi d\'abord.' },
      { status: 404 },
    )
  }

  const organizationId = profile.organization_id

  // Forger le payload Ringover (format réel de leur API)
  const fakePayload = {
    event: 'call.ended',
    organization_id: organizationId,
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
