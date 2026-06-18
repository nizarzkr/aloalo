import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { MOCK_TRANSCRIPTS } from '@/lib/dev/mock-transcripts'
import { createClient } from '@/lib/supabase/server'
import { isSimulatorEnabled } from '@/lib/dev/is-simulator-enabled'
import {
  apiLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'

// Outil DEV : simule un appel Ringover et le rejoue dans le webhook réel.
// Désactivé en production (cf. isSimulatorEnabled). Sinon : session requise +
// rate-limit Upstash pour contenir le coût AssemblyAI/Anthropic.

export async function POST(req: NextRequest) {
  // Hors prod uniquement : un 404 rend la route invisible en production.
  if (!isSimulatorEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Rate limit avant tout traitement — un simulate-call déclenche une vraie
  // analyse Claude (~0,005€ par hit). 10 req/10s par IP est suffisant pour
  // l'usage normal et stoppe net les boucles automatisées.
  const rl = await checkRateLimit(apiLimiter, getClientKey(req))
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds)
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
  // Provider simulé : 'ringover' (défaut) ou 'aircall' (J44). On rejoue le
  // webhook de chaque source dans son format réel pour tester son adaptateur.
  const provider = body.provider === 'aircall' ? 'aircall' : 'ringover'

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

  // Transcript de simulation, identique quel que soit le provider — c'est ce que
  // le webhook détecte (_sim_transcript) pour basculer en mode simulation.
  const simTranscript = {
    text: transcript.text,
    segments: transcript.segments,
    mock_id: transcript.id,
    title: transcript.title,
    // Identité CRM pré-câblée (démo / scénarios multi-contacts) — persistée
    // telle quelle sur l'appel par le webhook (cf. SimTranscriptSchema passthrough).
    contact_name: transcript.contact_name ?? null,
    company_name: transcript.company_name ?? null,
    deal_name: transcript.deal_name ?? null,
    deal_id: transcript.deal_id ?? null,
  }
  const callId = `sim_${Date.now()}`

  // Forger le payload dans le format RÉEL de la source choisie. Le webhook
  // correspondant reçoit donc exactement la forme qu'enverrait le vrai provider.
  let webhookPath: string
  let signatureHeader: string
  let payloadString: string

  if (provider === 'aircall') {
    // Aircall : enveloppe { resource, event, timestamp, token, data }, timestamps
    // en SECONDES UNIX. organization_id top-level = sim uniquement.
    const now = Math.floor(Date.now() / 1000)
    payloadString = JSON.stringify({
      resource: 'call',
      event: 'call.ended',
      timestamp: now,
      token: 'sim',
      organization_id: organizationId,
      data: {
        id: callId,
        direction: 'inbound',
        status: 'done',
        started_at: now - transcript.duration_seconds,
        ended_at: now,
        duration: transcript.duration_seconds,
        raw_digits: transcript.callee_number,
        recording: null, // Pas d'audio en simulation
        user_id: user.id,
        _sim_transcript: simTranscript,
      },
    })
    webhookPath = '/api/webhooks/aircall'
    signatureHeader = 'x-aircall-signature'
  } else {
    // Ringover : { event, organization_id, call }, started_at en ISO.
    payloadString = JSON.stringify({
      event: 'call.ended',
      organization_id: organizationId,
      call: {
        id: callId,
        from_number: transcript.caller_number,
        to_number: transcript.callee_number,
        duration: transcript.duration_seconds,
        recording_url: null,
        started_at: new Date(Date.now() - transcript.duration_seconds * 1000).toISOString(),
        user_id: user.id,
        _sim_transcript: simTranscript,
      },
    })
    webhookPath = '/api/webhooks/ringover'
    signatureHeader = 'x-ringover-signature'
  }

  // Signature HMAC-SHA256 avec le secret du simulateur (RINGOVER_WEBHOOK_SECRET).
  // Les deux webhooks vérifient cette même signature sur le chemin de simulation.
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex')

  const webhookUrl = new URL(webhookPath, req.url).toString()
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [signatureHeader]: signature,
    },
    body: payloadString,
  })

  const result = await response.json()

  return NextResponse.json({
    success: response.ok,
    provider,
    transcript_used: transcript.title,
    webhook_status: response.status,
    webhook_response: result,
  })
}
