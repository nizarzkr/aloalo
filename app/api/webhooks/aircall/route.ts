import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  webhookLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'
import { AircallWebhookSchema } from '@/lib/validations'
import { isSimulatorEnabled } from '@/lib/dev/is-simulator-enabled'
import { ingestRecording } from '@/lib/ingestion/ingest'
import type { NormalizedRecording, SimTranscript } from '@/lib/ingestion/types'

// ============================================================================
// ADAPTATEUR Aircall → couche d'ingestion commune (J44).
// ----------------------------------------------------------------------------
// Même rôle que l'adaptateur Ringover : parsing/validation Aircall, dérivation
// sûre de l'org, puis délégation du commun à ingestRecording (lib/ingestion).
//
// AUTH — deux chemins :
//   • RÉEL : Aircall met dans chaque payload un `token` unique au webhook. On
//     dérive l'org par lookup du SHA-256 de ce token (migration 0035). La
//     possession du token = preuve (secret partagé Aircall↔nous). La signature
//     X-Aircall-Signature (HMAC-SHA1) pourra durcir plus tard.
//   • SIMULATION (/api/dev/simulate-call) : le payload porte `_sim_transcript`.
//     Réservé au DEV (isSimulatorEnabled) ET signé HMAC-SHA256 avec le secret du
//     simulateur (RINGOVER_WEBHOOK_SECRET, seul secret de webhook existant) →
//     header x-aircall-signature. L'org vient de payload.organization_id (user
//     connecté). En production, _sim_transcript est ignoré (chemin réel) et
//     /api/transcribe bloque de toute façon les transcripts de simulation.
// ============================================================================

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(req: NextRequest) {
  // Rate limit — clé par IP, avant tout traitement coûteux.
  const rl = await checkRateLimit(webhookLimiter, getClientKey(req))
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds)
  }

  const body = await req.text()

  let rawPayload: unknown
  try {
    rawPayload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AircallWebhookSchema.safeParse(rawPayload)
  if (!parsed.success) {
    console.error('[webhook/aircall] payload invalide:', parsed.error.issues)
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 },
    )
  }
  const payload = parsed.data

  // On ne traite que la fin d'appel (recording prêt ~30 s après).
  if (payload.event !== 'call.ended') {
    return NextResponse.json({ received: true })
  }

  const call = payload.data
  const simTranscriptRaw = call._sim_transcript ?? null

  // Client admin (bypass RLS) — dérivation d'org + insert.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )

  let organizationId: string
  let recording: NormalizedRecording

  if (simTranscriptRaw) {
    // ── Chemin SIMULATION ────────────────────────────────────────────────────
    if (!isSimulatorEnabled()) {
      // En prod, on n'accepte jamais un transcript injecté via ce chemin.
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    // Signature du simulateur (HMAC-SHA256 avec RINGOVER_WEBHOOK_SECRET).
    const secret = process.env.RINGOVER_WEBHOOK_SECRET ?? ''
    const signature = req.headers.get('x-aircall-signature') ?? ''
    const expected = secret
      ? crypto.createHmac('sha256', secret).update(body).digest('hex')
      : ''
    if (!secret || !signature || !timingSafeEq(expected, signature)) {
      console.error('[webhook/aircall] signature simulateur invalide')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!payload.organization_id) {
      return NextResponse.json({ error: 'organization_id requis (sim)' }, { status: 400 })
    }
    organizationId = payload.organization_id

    const simTranscript: SimTranscript = {
      text: simTranscriptRaw.text,
      segments: simTranscriptRaw.segments as SimTranscript['segments'],
      duration_seconds: (call.duration as number | undefined) ?? 0,
      title: simTranscriptRaw.title,
    }

    recording = {
      provider: 'simulated',
      providerCallId: call.id,
      organizationId,
      durationSeconds: (call.duration as number | undefined) ?? null,
      startedAt: call.started_at ? new Date(call.started_at * 1000).toISOString() : null,
      calleeNumber: call.raw_digits ?? null,
      audioUrl: null,
      userId: (call.user_id as string | null | undefined) ?? null,
      contactName: (simTranscriptRaw.contact_name as string | null | undefined) ?? null,
      companyName: (simTranscriptRaw.company_name as string | null | undefined) ?? null,
      dealName: (simTranscriptRaw.deal_name as string | null | undefined) ?? null,
      dealId: (simTranscriptRaw.deal_id as string | null | undefined) ?? null,
      simTranscript,
    }
  } else {
    // ── Chemin RÉEL ──────────────────────────────────────────────────────────
    // On dérive l'org du token du webhook (jamais d'un id du body). Lookup par
    // SHA-256 (déterministe) ; la connaissance du token = preuve.
    const token = payload.token ?? ''
    if (!token) {
      console.error('[webhook/aircall] token absent — non authentifiable')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('aircall_webhook_token_hash', tokenHash)
      .maybeSingle()
    if (!org) {
      console.error('[webhook/aircall] token non rattaché à une org')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    organizationId = org.id

    recording = {
      provider: 'aircall',
      providerCallId: call.id,
      organizationId,
      durationSeconds: (call.duration as number | undefined) ?? null,
      // Aircall : timestamps en SECONDES UNIX → ISO.
      startedAt: call.started_at ? new Date(call.started_at * 1000).toISOString() : null,
      calleeNumber: call.raw_digits ?? null,
      // URL MP3 directe fournie dans le payload (valide 1h). ⚠️ l'hôte réel
      // devra figurer dans AUDIO_URL_ALLOWED_HOSTS (anti-SSRF, /api/transcribe).
      audioUrl: (call.recording as string | null | undefined) ?? null,
      userId: (call.user_id as string | null | undefined) ?? null,
    }
  }

  const result = await ingestRecording({ recording, triggerBaseUrl: req.url })

  if (result.outcome === 'duplicate') {
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (result.outcome === 'error') {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
