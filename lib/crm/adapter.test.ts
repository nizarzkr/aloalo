// ============================================================================
// Test unitaire — adaptateur CRM HubSpot (J45). Comment lancer : npm test
// ============================================================================
// On vérifie le CÂBLAGE de l'adaptateur, pas la logique HubSpot (déjà testée via
// lib/hubspot.ts) : (1) délégation aux fonctions lib/hubspot.ts avec le jeton
// résolu, (2) résolution paresseuse + mémoïsée du jeton (getHubspotToken appelé
// au plus une fois), (3) getStoredPipelines lit la DB sans résoudre de jeton,
// (4) dégradation « non connecté » quand le jeton est absent.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks des trois modules enveloppés par l'adaptateur.
vi.mock('@/lib/hubspot', () => ({
  searchContactByPhone: vi.fn(),
  getContact: vi.fn(),
  getContactCompany: vi.fn(),
  getMostRecentDealForContact: vi.fn(),
  resolveContactContext: vi.fn(),
  getDeal: vi.fn(async () => ({ id: 'd1', dealname: 'Deal 1' })),
  getDealCalls: vi.fn(),
  getContactEmailSignals: vi.fn(),
  getRecentWonDeals: vi.fn(),
  testHubspotConnection: vi.fn(),
  createNote: vi.fn(),
  createTask: vi.fn(),
  createTimelineEvent: vi.fn(),
}))
vi.mock('@/lib/hubspot-oauth', () => ({
  getHubspotToken: vi.fn(),
}))
vi.mock('@/lib/hubspot-pipelines', () => ({
  getOrgPipelines: vi.fn(async () => ({ pipelines: [], syncedAt: null })),
  syncOrgPipelines: vi.fn(),
}))
// getCrmAdapter lit organizations.crm_provider (J46) → on mocke Supabase pour
// renvoyer 'hubspot' (cas par défaut testé ici).
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { crm_provider: 'hubspot' } }),
        }),
      }),
    }),
  }),
}))

import * as hs from '@/lib/hubspot'
import { getHubspotToken } from '@/lib/hubspot-oauth'
import { getOrgPipelines } from '@/lib/hubspot-pipelines'
import { createHubspotAdapter } from '@/lib/crm/hubspot/adapter'
import { getCrmAdapter } from '@/lib/crm'

const ORG = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createHubspotAdapter', () => {
  it('isConnected reflète la présence du jeton', async () => {
    vi.mocked(getHubspotToken).mockResolvedValue('tok-123')
    expect(await createHubspotAdapter(ORG).isConnected()).toBe(true)

    vi.mocked(getHubspotToken).mockResolvedValue(null)
    expect(await createHubspotAdapter(ORG).isConnected()).toBe(false)
  })

  it('délègue à lib/hubspot avec le jeton résolu', async () => {
    vi.mocked(getHubspotToken).mockResolvedValue('tok-123')
    const crm = createHubspotAdapter(ORG)

    const deal = await crm.getDeal('d1')

    expect(hs.getDeal).toHaveBeenCalledWith('d1', 'tok-123')
    expect(deal).toEqual({ id: 'd1', dealname: 'Deal 1' })
  })

  it('jeton absent → chaîne vide passée aux fonctions (dégradation interne)', async () => {
    vi.mocked(getHubspotToken).mockResolvedValue(null)
    const crm = createHubspotAdapter(ORG)

    await crm.getDeal('d1')

    expect(hs.getDeal).toHaveBeenCalledWith('d1', '')
  })

  it('résout le jeton AU PLUS une fois (mémoïsation) sur plusieurs appels', async () => {
    vi.mocked(getHubspotToken).mockResolvedValue('tok-123')
    const crm = createHubspotAdapter(ORG)

    await crm.isConnected()
    await crm.getDeal('d1')
    await crm.getContact('c1')

    expect(getHubspotToken).toHaveBeenCalledTimes(1)
  })

  it('getStoredPipelines lit la DB SANS résoudre de jeton', async () => {
    const crm = createHubspotAdapter(ORG)

    const stored = await crm.getStoredPipelines()

    expect(getOrgPipelines).toHaveBeenCalledWith(ORG)
    expect(getHubspotToken).not.toHaveBeenCalled()
    expect(stored).toEqual({ pipelines: [], syncedAt: null })
  })
})

describe('getCrmAdapter', () => {
  it('renvoie l’adaptateur HubSpot (seul CRM en J45)', async () => {
    const crm = await getCrmAdapter(ORG)
    expect(crm.provider).toBe('hubspot')
  })
})
