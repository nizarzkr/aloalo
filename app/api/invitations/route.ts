// ============================================================================
// POST /api/invitations — créer une invitation et envoyer un email
// J8 étape 2 — uniquement les owners peuvent inviter
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

type Body = {
  email?: unknown
  role?: unknown
}

type ValidatedBody = {
  email: string
  role: 'manager' | 'sales'
}

const ALLOWED_ROLES = ['manager', 'sales'] as const

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

function validate(body: Body): ValidatedBody | null {
  if (typeof body.email !== 'string' || typeof body.role !== 'string') return null
  const email = body.email.trim().toLowerCase()
  // Validation simple — l'email final est de toute façon vérifié par Resend.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (!ALLOWED_ROLES.includes(body.role as (typeof ALLOWED_ROLES)[number])) return null
  return { email, role: body.role as 'manager' | 'sales' }
}

function buildEmailHtml(params: {
  inviterFirstName: string
  organizationName: string
  joinUrl: string
}): string {
  const { inviterFirstName, organizationName, joinUrl } = params
  return `<!doctype html>
<html lang="fr">
  <body style="font-family:system-ui,-apple-system,sans-serif;background:#f6f7f9;margin:0;padding:32px;color:#111">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 16px">Vous êtes invité à rejoindre ${organizationName} sur Aloalo</h1>
      <p style="line-height:1.5;margin:0 0 16px">
        ${inviterFirstName} vous invite à rejoindre <strong>${organizationName}</strong> sur Aloalo,
        la plateforme d'intelligence commerciale.
      </p>
      <p style="margin:24px 0">
        <a href="${joinUrl}"
           style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          Rejoindre l'équipe
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.5;margin:0">
        Ce lien expire dans 7 jours. Si vous n'attendiez pas cette invitation, ignorez cet email.
      </p>
    </div>
  </body>
</html>`
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Body
  let raw: Body
  try {
    raw = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const body = validate(raw)
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // 3. L'inviteur doit être owner — on lit son profil + son org via admin client
  //    pour récupérer aussi le nom de l'org sans dépendre de la RLS.
  const admin = getAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, organization_id, role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('profile lookup failed', profileError)
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  if (profile.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', profile.organization_id)
    .single()

  if (orgError || !org) {
    console.error('org lookup failed', orgError)
    return NextResponse.json({ error: 'organization_not_found' }, { status: 404 })
  }

  // 4. Pas de doublon profil dans la même org
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('organization_id', org.id)
    .eq('email', body.email)
    .maybeSingle()

  if (existingProfile) {
    return NextResponse.json({ error: 'already_member' }, { status: 409 })
  }

  // 5. Pas d'invitation pending non expirée pour ce couple (org, email)
  const nowIso = new Date().toISOString()
  const { data: pending } = await admin
    .from('invitations')
    .select('id')
    .eq('organization_id', org.id)
    .eq('email', body.email)
    .is('accepted_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle()

  if (pending) {
    return NextResponse.json({ error: 'already_invited' }, { status: 409 })
  }

  // 6. Création de l'invitation — token + expires_at générés par la DB
  const { data: invitation, error: insertError } = await admin
    .from('invitations')
    .insert({
      organization_id: org.id,
      email: body.email,
      role: body.role,
      invited_by: profile.id,
    })
    .select('id, token')
    .single()

  if (insertError || !invitation) {
    console.error('invitation insert failed', insertError)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  // 7. Envoi de l'email — non bloquant côté UX (mais on attend pour relayer l'erreur)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const joinUrl = `${appUrl}/join/${invitation.token}`
  const inviterFirstName =
    (profile.full_name?.trim().split(/\s+/)[0] ?? '') || profile.email

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({
      from: 'Aloalo <noreply@resend.dev>',
      to: body.email,
      subject: `Vous êtes invité à rejoindre ${org.name} sur Aloalo`,
      html: buildEmailHtml({
        inviterFirstName,
        organizationName: org.name,
        joinUrl,
      }),
    })
  } catch (err) {
    console.error('resend send failed', err)
    // L'invitation est créée, on retourne 200 mais on signale l'échec mail.
    return NextResponse.json(
      { success: true, invitation_id: invitation.id, email_sent: false },
      { status: 200 },
    )
  }

  return NextResponse.json(
    { success: true, invitation_id: invitation.id },
    { status: 200 },
  )
}
