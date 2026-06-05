// ============================================================================
// POST /api/invitations — créer une invitation et envoyer un email
// J8 étape 2 — uniquement les owners peuvent inviter
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import {
  apiLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'
import { InvitationSchema } from '@/lib/validations'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
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
  // Rate limit — clé par IP (avant auth pour fail-fast sur flood non-authentifié).
  const rl = await checkRateLimit(apiLimiter, getClientKey(req))
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds)
  }

  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Body — validation Zod
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = InvitationSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 },
    )
  }
  const body = parsed.data

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
      // Domaine d'envoi : pillarops.fr (utilisé pour les POC). Nécessite que le
      // domaine soit VÉRIFIÉ dans Resend (DNS SPF/DKIM) — sinon l'envoi échoue.
      from: 'Aloalo <noreply@pillarops.fr>',
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
    // revalidatePath : sans ça, le Server Component /dashboard/team peut
    // resservir des données cachées et la nouvelle ligne n'apparaît jamais
    // après router.refresh() côté client (cf. doc Next 16 use-router.md).
    revalidatePath('/dashboard/team')
    return NextResponse.json(
      { success: true, invitation_id: invitation.id, email_sent: false },
      { status: 200 },
    )
  }

  revalidatePath('/dashboard/team')
  return NextResponse.json(
    { success: true, invitation_id: invitation.id },
    { status: 200 },
  )
}
