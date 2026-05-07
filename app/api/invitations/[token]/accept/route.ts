// ============================================================================
// POST /api/invitations/[token]/accept — un user authentifié rejoint l'org
// J8 étape 2
// ============================================================================
// Flow attendu :
//  1. Le user clique le lien de l'email → page /join/[token]
//  2. Si pas de session, il signup/login avec le même email → trigger crée
//     son auth.users, son profile et une org par défaut
//  3. La page appelle ce POST → on remappe son profile vers l'org cible et on
//     supprime l'org orpheline créée au signup si elle est vide
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // 1. Auth user
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Validation du token (admin client, route protégée mais on bypass RLS
  //    pour rester cohérent avec GET /api/invitations/[token])
  const admin = getAdminClient()
  const { data: invitation, error: invError } = await admin
    .from('invitations')
    .select('id, email, role, accepted_at, expires_at, organization_id')
    .eq('token', token)
    .maybeSingle()

  if (invError) {
    console.error('invitation lookup failed', invError)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!invitation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'already_used' }, { status: 404 })
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 404 })
  }

  // 3. L'email du user authentifié doit matcher celui de l'invitation
  const userEmail = user.email?.toLowerCase() ?? ''
  if (userEmail !== invitation.email.toLowerCase()) {
    return NextResponse.json({ error: 'email_mismatch' }, { status: 403 })
  }

  // 4. Profil actuel du user — on a besoin de son ancienne org pour la nettoyer
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('profile lookup failed', profileError)
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }

  const previousOrgId = profile.organization_id

  // Idempotence : si le user est déjà dans la bonne org, on marque l'invitation
  // acceptée et on ne touche à rien d'autre.
  if (previousOrgId === invitation.organization_id) {
    if (!invitation.accepted_at) {
      await admin
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)
    }
    return NextResponse.json({ success: true })
  }

  // 5. Mise à jour du profil → org cible + role de l'invitation
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      organization_id: invitation.organization_id,
      role: invitation.role,
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('profile update failed', updateError)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  // 6. Si l'ancienne org du user est vide (orpheline créée au signup), on la
  //    supprime pour éviter de polluer la DB.
  if (previousOrgId) {
    const [{ count: memberCount }, { count: callCount }] = await Promise.all([
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', previousOrgId),
      admin
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', previousOrgId),
    ])

    if ((memberCount ?? 0) === 0 && (callCount ?? 0) === 0) {
      const { error: deleteError } = await admin
        .from('organizations')
        .delete()
        .eq('id', previousOrgId)
      if (deleteError) {
        // Non bloquant : l'invitation a réussi, on log juste.
        console.error('orphan org cleanup failed', deleteError)
      }
    }
  }

  // 7. Marquer l'invitation comme acceptée
  const { error: acceptError } = await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  if (acceptError) {
    console.error('invitation accept update failed', acceptError)
    // Le profil est déjà migré, on ne casse pas le flow utilisateur.
  }

  return NextResponse.json({ success: true })
}
