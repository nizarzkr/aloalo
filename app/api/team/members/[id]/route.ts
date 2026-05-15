// ============================================================================
// PATCH /api/team/members/[id] — retirer un membre de l'org (owner uniquement)
// ============================================================================
// On NE supprime PAS le compte auth.users : on détache juste le profile de
// l'org en mettant organization_id à NULL. La RLS empêchera dès lors le
// membre de voir les données de l'org.
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

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params

  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Garde-fou : un owner ne peut pas se retirer lui-même
  if (targetId === user.id) {
    return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 })
  }

  // 3. Profil owner + même org que la cible
  const admin = getAdminClient()
  const { data: viewer } = await admin
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

  if (!viewer) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  if (viewer.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: target } = await admin
    .from('profiles')
    .select('id, organization_id')
    .eq('id', targetId)
    .maybeSingle()

  if (!target || target.organization_id !== viewer.organization_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 4. Détacher le profil — nullable depuis la migration 0005.
  //    removed_at servira au cron RGPD qui supprimera définitivement le compte
  //    après 90 jours (cf. roadmap J11/J12).
  const { error: updateError } = await admin
    .from('profiles')
    .update({ organization_id: null, removed_at: new Date().toISOString() })
    .eq('id', targetId)

  if (updateError) {
    console.error('member remove failed', updateError)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  // Invalide le cache serveur de /dashboard/team — sinon le membre détaché
  // peut continuer d'apparaître au prochain rendu serveur (cf. POST).
  revalidatePath('/dashboard/team')
  return NextResponse.json({ success: true })
}
