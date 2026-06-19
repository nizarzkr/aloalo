// ============================================================================
// Test unitaire — adaptateur CRM Pipedrive + aiguillage getCrmAdapter (J46).
// ============================================================================
// (1) Câblage de l'adaptateur Pipedrive : délégation à lib/pipedrive avec le
//     couple { token, apiDomain } résolu, mémoïsation (getPipedriveContext appelé
//     au plus une fois), getStoredPipelines sans contexte, dégradation hors-connexion.
// (2) Aiguillage getCrmAdapter : renvoie l'adaptateur Pipedrive quand
//     crm_provider='pipedrive', HubSpot par défaut.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks des modules enveloppés par l'adaptateur Pipedrive ---
vi.mock('@/lib/pipedrive', () => ({
  searchPersonByPhone: vi.fn(),
  getPerson: vi.fn(),
  getPersonOrganization: vi.fn(),
  getMostRecentDealForPerson: vi.fn(),
  resolvePersonContext: vi.fn(),
  getDeal: vi.fn(async () => ({ id: 'd1', dealname: 'Deal 1' })),
  getRecentWonDeals: vi.fn(),
  getPipelinesAndStages: vi.fn(),
  createNote: vi.fn(),
  createTask: vi.fn(),
  testConnection: vi.fn(),
  getDealCalls: vi.fn(async () => []),
  getPersonEmailSignals: vi.fn(async () => null),
  createTimelineEvent: vi.fn(async () => true),
}))
vi.mock('@/lib/pipedrive-oauth', () => ({
  getPipedriveContext: vi.fn(),
}))
vi.mock('@/lib/hubspot-pipelines', () => ({
  getOrgPipelines: vi.fn(async () => ({ pipelines: [], syncedAt: null })),
  persistOrgPipelines: vi.fn(),
}))

// --- Mock Supabase pour piloter crm_provider (aiguillage getCrmAdapter) ---
let mockProvider: string | null = 'hubspot'
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { crm_provider: mockProvider } }),
        }),
      }),
    }),
  }),
}))

import * as pd from '@/lib/pipedrive'
import { getPipedriveContext } from '@/lib/pipedrive-oauth'
import { getOrgPipelines } from '@/lib/hubspot-pipelines'
import { createPipedriveAdapter } from '@/lib/crm/pipedrive/adapter'
import { getCrmAdapter } from '@/lib/crm'

const ORG = '00000000-0000-0000-0000-000000000001'
const CTX = { token: 'tok-123', apiDomain: 'https://acme.pipedrive.com' }

beforeEach(() => {
  vi.clearAllMocks()
  mockProvider = 'hubspot'
})

describe('createPipedriveAdapter', () => {
  it('délègue à lib/pipedrive avec { token, apiDomain } résolus', async () => {
    vi.mocked(getPipedriveContext).mockResolvedValue(CTX)
    const crm = createPipedriveAdapter(ORG)

    const deal = await crm.getDeal('d1')

    expect(pd.getDeal).toHaveBeenCalledWith(CTX.apiDomain, CTX.token, 'd1')
    expect(deal).toEqual({ id: 'd1', dealname: 'Deal 1' })
  })

  it('non connecté (contexte null) → dégrade sans appeler lib/pipedrive', async () => {
    vi.mocked(getPipedriveContext).mockResolvedValue(null)
    const crm = createPipedriveAdapter(ORG)

    expect(await crm.getDeal('d1')).toBeNull()
    expect(await crm.isConnected()).toBe(false)
    expect(pd.getDeal).not.toHaveBeenCalled()
  })

  it('résout le contexte AU PLUS une fois (mémoïsation)', async () => {
    vi.mocked(getPipedriveContext).mockResolvedValue(CTX)
    const crm = createPipedriveAdapter(ORG)

    await crm.isConnected()
    await crm.getDeal('d1')
    await crm.getRecentWonDeals()

    expect(getPipedriveContext).toHaveBeenCalledTimes(1)
  })

  it('getStoredPipelines lit la DB SANS résoudre de contexte Pipedrive', async () => {
    const crm = createPipedriveAdapter(ORG)

    const stored = await crm.getStoredPipelines()

    expect(getOrgPipelines).toHaveBeenCalledWith(ORG)
    expect(getPipedriveContext).not.toHaveBeenCalled()
    expect(stored).toEqual({ pipelines: [], syncedAt: null })
  })
})

describe('getCrmAdapter (aiguillage crm_provider)', () => {
  it("crm_provider='pipedrive' → adaptateur Pipedrive", async () => {
    mockProvider = 'pipedrive'
    const crm = await getCrmAdapter(ORG)
    expect(crm.provider).toBe('pipedrive')
  })

  it('défaut (hubspot) → adaptateur HubSpot', async () => {
    mockProvider = 'hubspot'
    const crm = await getCrmAdapter(ORG)
    expect(crm.provider).toBe('hubspot')
  })

  it('crm_provider null → repli HubSpot', async () => {
    mockProvider = null
    const crm = await getCrmAdapter(ORG)
    expect(crm.provider).toBe('hubspot')
  })
})
