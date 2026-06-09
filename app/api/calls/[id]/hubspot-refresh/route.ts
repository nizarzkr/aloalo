// ============================================================================
// POST /api/calls/[id]/hubspot-refresh — re-enrichit un appel depuis HubSpot
// ============================================================================
// Déclenché par le bouton « Rafraîchir depuis HubSpot » sur la page détail.
// Re-résout le numéro de l'appel vers le CRM (contact + entreprise + deal le
// plus récent) et met à jour les colonnes d'affichage de l'appel.
//
// Ne crée PAS de note/tâche (ça reste le rôle de /api/analyze pour éviter les
// doublons). C'est purement un rafraîchissement des infos affichées.
//
// Auth : l'utilisateur doit être connecté et l'appel doit appartenir à son org.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enrichCallFromHubspot } from '@/lib/hubspot-sync'
import { decryptSecret } from '@/lib/crypto/org-secrets'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

export async function POST(
  _req: NextRequest,
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

  // 3. L'appel doit appartenir à l'org de l'utilisateur (anti-accès cross-org).
  const { data: call } = await admin
    .from('calls')
    .select('id, callee_number')
    .eq('id', callId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!call) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 4. Token HubSpot de l'org
  const { data: org } = await admin
    .from('organizations')
    .select('hubspot_token')
    .eq('id', orgId)
    .single()

  // Token stocké chiffré au repos (issue #5) → déchiffrement avant usage.
  const token = decryptSecret((org?.hubspot_token as string | null) ?? null)
  if (!token) {
    return NextResponse.json({ error: 'hubspot_not_connected' }, { status: 400 })
  }

  const phone = (call.callee_number as string | null) ?? null
  if (!phone) {
    return NextResponse.json({ error: 'no_phone' }, { status: 400 })
  }

  // 5. Enrichissement (écrit les colonnes d'affichage côté serveur).
  const ctx = await enrichCallFromHubspot(admin, callId, phone, token)

  // Invalide le cache serveur des vues qui affichent ces infos — sinon le rendu
  // serveur suivant resservirait l'ancien affichage (cf. router.refresh seul ne
  // suffit pas en Next 16).
  revalidatePath(`/dashboard/calls/${callId}`)
  revalidatePath('/dashboard/calls')
  revalidatePath('/dashboard')

  return NextResponse.json({
    success: true,
    found: Boolean(ctx.contact),
    contact_name: ctx.contact
      ? [ctx.contact.firstname, ctx.contact.lastname].filter(Boolean).join(' ') ||
        null
      : null,
    company_name: ctx.company?.name ?? null,
    deal_name: ctx.deal?.dealname ?? null,
  })
}
