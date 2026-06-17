// ============================================================================
// Test unitaire — règles de détection d'écarts d'hygiène (J30)
// ============================================================================
// Comment lancer : npm test
// Fige la logique pure de lib/hygiene/rules.ts (déterministe + mapping IA +
// priorisation), sans I/O ni mock.
// ============================================================================

import { describe, it, expect } from 'vitest'

import type { ExitCriterion } from '@/lib/exit-criteria'
import {
  deriveDeterministicGaps,
  gapsFromAiEval,
  prioritizeGaps,
  type DeterministicInput,
  type HygieneEvalResult,
} from '@/lib/hygiene/rules'

const BASE: DeterministicInput = {
  hasDealId: true,
  stageKnown: true,
  status: 'actif',
  latestSuggestedTasksCount: 1,
}

describe('deriveDeterministicGaps', () => {
  it('deal actif avec next step daté + phase connue : aucun écart', () => {
    expect(deriveDeterministicGaps(BASE)).toEqual([])
  })

  it('deal dormant → écart dormant_open_deal (high)', () => {
    const gaps = deriveDeterministicGaps({ ...BASE, status: 'dormant' })
    expect(gaps.map((g) => g.type)).toContain('dormant_open_deal')
    expect(gaps.find((g) => g.type === 'dormant_open_deal')?.severity).toBe(
      'high',
    )
  })

  it('deal actif sans next step daté → no_next_step', () => {
    const gaps = deriveDeterministicGaps({
      ...BASE,
      latestSuggestedTasksCount: 0,
    })
    expect(gaps.map((g) => g.type)).toEqual(['no_next_step'])
  })

  it('phase non reconnue + deal HubSpot → stage_unmapped', () => {
    const gaps = deriveDeterministicGaps({ ...BASE, stageKnown: false })
    expect(gaps.map((g) => g.type)).toContain('stage_unmapped')
  })

  it('deal sans id HubSpot : pas de stage_unmapped même si phase inconnue', () => {
    const gaps = deriveDeterministicGaps({
      ...BASE,
      hasDealId: false,
      stageKnown: false,
    })
    expect(gaps.map((g) => g.type)).not.toContain('stage_unmapped')
  })

  it('deal dormant ne déclenche pas no_next_step (réservé aux actifs)', () => {
    const gaps = deriveDeterministicGaps({
      ...BASE,
      status: 'dormant',
      latestSuggestedTasksCount: 0,
    })
    expect(gaps.map((g) => g.type)).not.toContain('no_next_step')
  })
})

const CRITERIA: ExitCriterion[] = [
  { id: 'c1', label: 'Budget confirmé' },
  { id: 'c2', label: 'Décideur identifié' },
]

describe('gapsFromAiEval', () => {
  it('critères non remplis → un écart exit_criteria_unmet listant les bons libellés', () => {
    const result: HygieneEvalResult = {
      exit_criteria: [
        { id: 'c1', met: false, evidence: '' },
        { id: 'c2', met: true, evidence: 'décideur présent' },
      ],
      stage_mismatch: { mismatch: false, reason: '', suggested_direction: 'none' },
    }
    const gaps = gapsFromAiEval(CRITERIA, result)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].type).toBe('exit_criteria_unmet')
    expect(gaps[0].unmet_criteria).toEqual([{ id: 'c1', label: 'Budget confirmé' }])
  })

  it('ignore un id de critère halluciné (absent de la liste fournie)', () => {
    const result: HygieneEvalResult = {
      exit_criteria: [{ id: 'inconnu', met: false, evidence: '' }],
      stage_mismatch: { mismatch: false, reason: '', suggested_direction: 'none' },
    }
    expect(gapsFromAiEval(CRITERIA, result)).toEqual([])
  })

  it('mismatch de phase → écart stage_reality_mismatch (high) avec le motif', () => {
    const result: HygieneEvalResult = {
      exit_criteria: [],
      stage_mismatch: {
        mismatch: true,
        reason: 'Le prospect redemande une démo alors que le deal est en Closing.',
        suggested_direction: 'earlier',
      },
    }
    const gaps = gapsFromAiEval(CRITERIA, result)
    expect(gaps.map((g) => g.type)).toEqual(['stage_reality_mismatch'])
    expect(gaps[0].severity).toBe('high')
    expect(gaps[0].detail).toContain('démo')
  })
})

describe('prioritizeGaps', () => {
  it('trie high → medium → low, stable à sévérité égale', () => {
    const gaps = gapsFromAiEval(CRITERIA, {
      exit_criteria: [{ id: 'c1', met: false, evidence: '' }],
      stage_mismatch: { mismatch: false, reason: '', suggested_direction: 'none' },
    })
      .concat(
        deriveDeterministicGaps({
          ...BASE,
          status: 'dormant',
          stageKnown: false,
        }),
      )
    const sorted = prioritizeGaps(gaps)
    const severities = sorted.map((g) => g.severity)
    // Vérifie l'ordre non décroissant de priorité.
    const rank = { high: 0, medium: 1, low: 2 } as const
    for (let i = 1; i < severities.length; i++) {
      expect(rank[severities[i]]).toBeGreaterThanOrEqual(rank[severities[i - 1]])
    }
    expect(severities[0]).toBe('high')
  })
})
