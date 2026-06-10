// ============================================================================
// Test de non-régression — isolation multi-tenant de /api/calls/[id]/status
// Issue #26 (audit pré-PoC du 2026-06-08)
// ============================================================================
// Comment lancer :  npm test
// Env requis     :  aucun pour le test « unitaire » ci-dessous (Supabase mocké).
//                   Le bloc d'intégration RLS réelle (skipIf) ne tourne que si
//                   SUPABASE_TEST_URL est défini (DB de test jetable).
//
// Ce que ce fichier garde : le contrat de sécurité documenté en tête de
// app/api/calls/[id]/status/route.ts — « la RLS garantit qu'il ne lit qu'un
// appel de son org ». Si une future migration retire/affaiblit la policy SELECT
// de `calls`, le handler se mettrait à renvoyer le statut d'un appel d'une AUTRE
// org. Le test « fail-closed » ci-dessous fige le comportement attendu :
//   - data null (RLS a filtré la ligne → org A ne voit pas l'appel d'org B) → 404
//   - user null (non authentifié)                                            → 401
//   - data présent (appel de mon org)                                        → 200
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock du client Supabase serveur -----------------------------------------
// On remplace createClient pour piloter ce que renvoient getUser() et la query
// `.from('calls').select('status').eq('id', …).maybeSingle()`. Mocker tout le
// module évite de charger next/headers (qui exige un contexte de requête Next).
const maybeSingle = vi.fn()
const getUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  })),
}))

// Importé APRÈS le mock pour que le handler récupère la version mockée.
import { GET } from '@/app/api/calls/[id]/status/route'

// Petit helper : fabrique l'argument `{ params }` attendu par le handler.
function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

// Le 1er argument (NextRequest) n'est pas utilisé par le handler → cast minimal.
const req = {} as Parameters<typeof GET>[0]

describe('GET /api/calls/[id]/status — fail-closed multi-tenant', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    getUser.mockReset()
  })

  it('renvoie 401 si non authentifié', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const res = await GET(req, ctx('call-xyz'))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'unauthorized' })
    // On ne doit même pas interroger la table sans user.
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it("renvoie 404 quand la RLS filtre l'appel (org A lit un appel d'org B)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-org-A' } } })
    // RLS a filtré la ligne d'org B → la query ne renvoie aucune ligne.
    maybeSingle.mockResolvedValue({ data: null, error: null })

    const res = await GET(req, ctx('call-belonging-to-org-B'))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'not_found' })
  })

  it('renvoie 200 + statut pour un appel de ma propre org', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-org-A' } } })
    maybeSingle.mockResolvedValue({ data: { status: 'analyzed' }, error: null })

    const res = await GET(req, ctx('call-of-org-A'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'analyzed' })
  })
})

// ============================================================================
// Garde le plus fort (DB-backed) — non exécuté par défaut.
// ============================================================================
// TODO(#26) : le test ci-dessus vérifie le comportement fail-closed du handler,
// mais il MOCKE Supabase → il n'exerce PAS réellement la RLS Postgres. Le garde
// le plus honnête est un test d'intégration contre un Postgres local avec les
// migrations appliquées : seeder 2 orgs (A et B) + 1 appel dans B, ouvrir un
// client RLS-scopé pour un user d'org A (clé publishable + JWT) et asserter que
// `select status from calls where id = <appel d'org B>` ne renvoie AUCUNE ligne.
// Sauté tant que SUPABASE_TEST_URL n'est pas configuré (CI/local restent verts).
describe.skipIf(!process.env.SUPABASE_TEST_URL)(
  'RLS réelle (intégration Postgres) — à implémenter',
  () => {
    it("org A ne lit pas l'appel d'org B (404 / 0 ligne)", () => {
      // À implémenter quand une DB de test (supabase start) sera disponible :
      // appliquer supabase/migrations/*.sql, seeder, puis asserter 0 ligne.
      expect(true).toBe(true)
    })
  },
)
