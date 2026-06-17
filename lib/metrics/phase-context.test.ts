// ============================================================================
// Test unitaire — contexte phase du tunnel (J32)
// ============================================================================
// Comment lancer : npm test
// Fige findStageInfo (avancement) + buildDealPhaseContext (lecture des écarts
// d'hygiène + inactivité), sans I/O.
// ============================================================================

import { describe, it, expect } from 'vitest'

import type { HubspotPipeline } from '@/lib/hubspot'
import type { HygieneGap } from '@/lib/hygiene/types'
import { findStageInfo, buildDealPhaseContext } from '@/lib/metrics/phase-context'

const PIPELINES: HubspotPipeline[] = [
  {
    id: 'default',
    label: 'Pipeline de vente',
    displayOrder: 0,
    stages: [
      { id: 's1', label: 'Prise de contact', displayOrder: 0, isClosed: false, probability: null },
      { id: 's2', label: 'Démo', displayOrder: 1, isClosed: false, probability: null },
      { id: 's3', label: 'Négociation', displayOrder: 2, isClosed: false, probability: 0.8 },
      { id: 'won', label: 'Gagné', displayOrder: 3, isClosed: true, probability: 1 },
    ],
  },
]

describe('findStageInfo', () => {
  it('renvoie null pour un stage inconnu ou nul', () => {
    expect(findStageInfo(PIPELINES, null)).toBeNull()
    expect(findStageInfo(PIPELINES, 'inconnu')).toBeNull()
  })

  it('utilise la probabilité HubSpot quand elle est définie', () => {
    expect(findStageInfo(PIPELINES, 's3')).toEqual({
      label: 'Négociation',
      isClosed: false,
      advancement: 0.8,
    })
  })

  it('replie sur le rang normalisé parmi les phases ouvertes sans probabilité', () => {
    // s1, s2, s3 ouvertes → 3 phases, rangs 0/2, 1/2, 2/2. s1 = 0.
    expect(findStageInfo(PIPELINES, 's1')?.advancement).toBe(0)
    expect(findStageInfo(PIPELINES, 's2')?.advancement).toBeCloseTo(0.5)
  })

  it('marque les phases clôturées', () => {
    expect(findStageInfo(PIPELINES, 'won')?.isClosed).toBe(true)
  })
})

const UNMET_GAP: HygieneGap = {
  type: 'exit_criteria_unmet',
  severity: 'medium',
  title: '2 critères de sortie non remplis',
  detail: '',
  unmet_criteria: [
    { id: 'c1', label: 'Budget confirmé' },
    { id: 'c2', label: 'Décideur identifié' },
  ],
}

const MISMATCH_GAP: HygieneGap = {
  type: 'stage_reality_mismatch',
  severity: 'high',
  title: 'Phase CRM ≠ réalité',
  detail: '',
}

describe('buildDealPhaseContext', () => {
  it('renvoie null si la phase n’est pas reconnue dans le tunnel', () => {
    const ctx = buildDealPhaseContext({
      stageId: 'inconnu',
      pipelines: PIPELINES,
      gaps: [],
      daysInactive: 0,
    })
    expect(ctx).toBeNull()
  })

  it('assemble libellé, ouverture, avancement, inactivité (planchée à 0)', () => {
    const ctx = buildDealPhaseContext({
      stageId: 's3',
      pipelines: PIPELINES,
      gaps: [],
      daysInactive: 21.7,
    })
    expect(ctx).toEqual({
      stage_label: 'Négociation',
      is_open: true,
      advancement: 0.8,
      days_inactive: 21,
      unmet_criteria: [],
      stage_mismatch: false,
    })
  })

  it('extrait les critères non remplis et le mismatch depuis les écarts d’hygiène', () => {
    const ctx = buildDealPhaseContext({
      stageId: 's3',
      pipelines: PIPELINES,
      gaps: [UNMET_GAP, MISMATCH_GAP],
      daysInactive: 3,
    })
    expect(ctx?.unmet_criteria).toEqual(['Budget confirmé', 'Décideur identifié'])
    expect(ctx?.stage_mismatch).toBe(true)
  })
})
