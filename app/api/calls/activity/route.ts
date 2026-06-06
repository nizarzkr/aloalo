// ============================================================================
// GET /api/calls/activity — y a-t-il des appels en cours ? (polling liste)
// ============================================================================
// Interrogé toutes les ~4 s par la liste des appels tant qu'au moins un appel
// est en traitement. Retourne une SIGNATURE des appels en cours (id:status) :
// elle change dès qu'un appel avance de phase ou se termine → le client sait
// alors qu'il doit rafraîchir la liste. Pur lecture, aucun effet de bord.
//
// Auth : utilisateur connecté ; scope org explicite + RLS.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSignature, IN_PROGRESS_STATUSES } from '@/lib/call-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organization_id
  if (!orgId) {
    return NextResponse.json({ signature: '', active: false })
  }

  const { data } = await supabase
    .from('calls')
    .select('id, status')
    .eq('organization_id', orgId)
    .in('status', [...IN_PROGRESS_STATUSES])

  const rows = (data ?? []) as Array<{ id: string; status: string }>
  return NextResponse.json({
    signature: buildSignature(rows),
    active: rows.length > 0,
  })
}
