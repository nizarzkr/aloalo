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

  // 6. Insérer en base avec le client admin (bypass RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { error } = await supabase.from('calls').insert({
  organization_id: organizationId,
  provider: 'ringover',
  provider_call_id: call.id as string,
  callee_number: call.to_number as string,
  duration_seconds: call.duration as number,
  audio_url: (call.recording_url as string) ?? null,
  status: 'pending',
  started_at: call.started_at as string,
    })

  if (error) {
    console.error('[webhook/ringover] Erreur insertion:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  console.log('[webhook/ringover] Appel inséré ✅', call.id)
  return NextResponse.json({ received: true })
}
