// ============================================================================
// GET /api/calls/[id]/status — statut courant d'un appel (polling léger)
// ============================================================================
// Interrogé toutes les ~3 s par le stepper de la page détail tant que l'appel
// n'est pas terminé. Pur lecture, aucun effet de bord (pas de revalidate) :
// c'est le client qui décide de rafraîchir le rendu serveur au moment voulu.
//
// Auth : utilisateur connecté ; la RLS garantit qu'il ne lit qu'un appel de
// son org. force-dynamic pour ne jamais servir un statut en cache.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: callId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // RLS scope l'accès à l'org de l'utilisateur ; maybeSingle → null si absent.
  const { data } = await supabase
    .from('calls')
    .select('status')
    .eq('id', callId)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ status: data.status as string })
}
