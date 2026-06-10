// ============================================================================
// POST /api/calls/[id]/retry-transcription — relance la transcription d'un appel échoué
// ============================================================================
// Déclenché par le bouton « Relancer la transcription » sur la page détail,
// visible uniquement quand status === 'failed' (hors limite d'usage).
// Remet l'appel en 'pending', efface error_message, puis re-déclenche
// /api/transcribe (qui retombe sur calls.audio_url, cf. son commentaire).
//
// Auth : l'utilisateur doit être connecté et l'appel doit appartenir à son org.
// La route écrit avec la service key (bypass RLS) → elle DOIT faire sa propre
// autorisation (calque de /api/calls/[id]/hubspot-refresh).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: callId } = await params

  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Org de l'utilisateur
  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organization_id
  if (!orgId) {
    return NextResponse.json({ error: 'no_org' }, { status: 403 })
  }

  // 3. L'appel doit appartenir à l'org ET être en échec (anti-accès cross-org +
  //    on ne relance que ce qui a vraiment échoué).
  const { data: call } = await admin
    .from('calls')
    .select('id, status, audio_url')
    .eq('id', callId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!call) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (call.status !== 'failed') {
    return NextResponse.json({ error: 'not_failed' }, { status: 409 })
  }
  if (!call.audio_url) {
    // L'audio a été purgé (RGPD) après une transcription réussie, ou jamais
    // résolu — pas de matière à re-transcrire.
    return NextResponse.json({ error: 'no_audio' }, { status: 409 })
  }

  // 4. Remettre en 'pending' + effacer l'ancien message d'échec.
  await admin
    .from('calls')
    .update({ status: 'pending', error_message: null })
    .eq('id', callId)

  // 5. Re-déclencher /api/transcribe sans body audio : il retombe sur
  //    calls.audio_url. /api/transcribe est protégée par verifyInternalSecret →
  //    on envoie le header x-aloalo-internal (sinon 401). On utilise l'origin de
  //    la requête courante (même logique que /api/analyze).
  const appUrl = req.nextUrl.origin
  fetch(`${appUrl}/api/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-aloalo-internal': process.env.INTERNAL_PIPELINE_SECRET ?? '',
    },
    body: JSON.stringify({ callId }),
  }).catch(() => {
    /* fire-and-forget : la page reflètera l'avancement via le polling existant */
  })

  revalidatePath(`/dashboard/calls/${callId}`)
  revalidatePath('/dashboard/calls')
  revalidatePath('/dashboard')

  return NextResponse.json({ success: true })
}
