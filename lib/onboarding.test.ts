// ============================================================================
// Test unitaire — dérivation des étapes d'onboarding (J29)
// ============================================================================
// Comment lancer : npm test
//
// Fige la logique « étape faite = signal réel présent » de lib/onboarding.ts.
// deriveSteps est PURE (pas d'I/O), donc testée directement, sans mock. Cas
// couverts : org vierge, token HubSpot sans tunnel (étape NON faite), reprise
// (firstIncompleteStep), ordre du parcours, complétion.
// ============================================================================

import { describe, it, expect } from 'vitest'

import { deriveSteps, type OnboardingSignals } from '@/lib/onboarding'

const NONE: OnboardingSignals = {
  hasRingoverKey: false,
  hasHubspotToken: false,
  hasPipelines: false,
  hasExitCriteria: false,
}

describe('deriveSteps', () => {
  it('org vierge : aucune étape faite, on reprend à la téléphonie', () => {
    const s = deriveSteps(NONE, null)
    expect(s.steps).toEqual({
      telephony: false,
      hubspot: false,
      criteria: false,
    })
    expect(s.doneCount).toBe(0)
    expect(s.firstIncompleteStep).toBe('telephony')
    expect(s.completedAt).toBeNull()
  })

  it('token HubSpot SANS tunnel synchronisé : étape hubspot NON faite', () => {
    const s = deriveSteps(
      { ...NONE, hasHubspotToken: true, hasPipelines: false },
      null,
    )
    expect(s.steps.hubspot).toBe(false)
  })

  it('token HubSpot + tunnel synchronisé : étape hubspot faite', () => {
    const s = deriveSteps(
      { ...NONE, hasHubspotToken: true, hasPipelines: true },
      null,
    )
    expect(s.steps.hubspot).toBe(true)
  })

  it('reprise : téléphonie faite → on reprend à HubSpot', () => {
    const s = deriveSteps({ ...NONE, hasRingoverKey: true }, null)
    expect(s.doneCount).toBe(1)
    expect(s.firstIncompleteStep).toBe('hubspot')
  })

  it('téléphonie + HubSpot faites mais pas les critères → reprend aux critères', () => {
    const s = deriveSteps(
      {
        hasRingoverKey: true,
        hasHubspotToken: true,
        hasPipelines: true,
        hasExitCriteria: false,
      },
      null,
    )
    expect(s.doneCount).toBe(2)
    expect(s.firstIncompleteStep).toBe('criteria')
  })

  it('toutes les étapes faites : firstIncompleteStep = null', () => {
    const s = deriveSteps(
      {
        hasRingoverKey: true,
        hasHubspotToken: true,
        hasPipelines: true,
        hasExitCriteria: true,
      },
      '2026-06-17T12:00:00Z',
    )
    expect(s.doneCount).toBe(3)
    expect(s.firstIncompleteStep).toBeNull()
    expect(s.completedAt).toBe('2026-06-17T12:00:00Z')
  })

  it('la 1re étape incomplète respecte l’ordre téléphonie → hubspot → critères', () => {
    // Critères faits mais téléphonie absente : on reprend quand même au début.
    const s = deriveSteps({ ...NONE, hasExitCriteria: true }, null)
    expect(s.firstIncompleteStep).toBe('telephony')
  })
})
