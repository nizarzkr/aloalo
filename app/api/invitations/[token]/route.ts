// ============================================================================
// /api/invitations/[token] — endpoints publics + admin
// ============================================================================
// GET    : valide un token d'invitation (route publique, appelée depuis /join)
// DELETE : annule une invitation pending (owner uniquement)
//          Note routing : Next interdit deux segments dynamiques siblings, donc
//          le segment reste nommé [token] mais le handler DELETE interprète la
//          valeur comme l'invitation.id (le caller passe invitation.id).
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

type InvalidReason = 'expired' | 'already_used' | 'not_found'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token) {
    return NextResponse.json(
      { valid: false, reason: 'not_found' satisfies InvalidReason },
      { status: 404 },
    )
  }

  const admin = getAdminClient()
  const { data: invitation, error } = await admin
    .from('invitations')
    .select(
      'id, email, role, accepted_at, expires_at, organization_id, organizations(name)',
    )
    .eq('token', token)
    .maybeSingle<{
      id: string
      email: string
      role: string
      accepted_at: string | null
      expires_at: string
      organization_id: string
      organizations: { name: string } | { name: string }[] | null
    }>()

  if (error) {
    console.error('invitation lookup failed', error)
    return NextResponse.json(
      { valid: false, reason: 'not_found' satisfies InvalidReason },
      { status: 500 },
    )
  }

  if (!invitation) {
    return NextResponse.json(
      { valid: false, reason: 'not_found' satisfies InvalidReason },
      { status: 404 },
    )
  }

  if (invitation.accepted_at) {
    return NextResponse.json(
      { valid: false, reason: 'already_used' satisfies InvalidReason },
      { status: 200 },
    )
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { valid: false, reason: 'expired' satisfies InvalidReason },
      { status: 200 },
    )
  }

  // Selon la version du client Supabase, la jointure peut renvoyer un objet
  // ou un tableau. On normalise.
  const orgRel = invitation.organizations
  const organizationName = Array.isArray(orgRel)
    ? orgRel[0]?.name ?? ''
    : orgRel?.name ?? ''

  return NextResponse.json({
    valid: true,
    email: invitation.email,
    role: invitation.role,
    organization_name: organizationName,
  })
}

// ============================================================================
// DELETE — annulation d'une invitation pending (owner uniquement)
// ============================================================================
// La valeur du segment d'URL est ici l'invitation.id (UUID), pas un token.
// On garde le nom [token] pour ne pas casser les autres routes (cf. en-tête).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: invitationId } = await params

  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Profil + role
  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  if (profile.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 3. L'invitation doit appartenir à la même org
  const { data: invitation } = await admin
    .from('invitations')
    .select('id, organization_id, accepted_at')
    .eq('id', invitationId)
    .maybeSingle()

  if (!invitation || invitation.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'already_accepted' }, { status: 409 })
  }

  // 4. Suppression
  const { error: deleteError } = await admin
    .from('invitations')
    .delete()
    .eq('id', invitationId)

  if (deleteError) {
    console.error('invitation delete failed', deleteError)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }

  // Invalide le cache serveur de /dashboard/team — sinon la ligne supprimée
  // pourrait réapparaître au prochain rendu serveur (cf. POST).
  revalidatePath('/dashboard/team')
  return NextResponse.json({ success: true })
}
