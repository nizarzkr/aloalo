// ============================================================================
// Test unitaire — Fiabilité du forecast (J33)
// ============================================================================
// Comment lancer : npm test
// Fige computeForecastConfidence : gating (phase fermée / inconnue / pas
// d'engagement) + verdicts (optimiste / sous-estimé / aligné) + pénalités.
// ============================================================================

import { describe, it, expect } from 'vitest'

import {
  computeForecastConfidence,
  type ForecastInput,
} from '@/lib/metrics/forecast-confidence'

const BASE: ForecastInput = {
  advancement: 0.8,
  isOpen: true,
  lastEngagement: 70,
  declining: false,
  unmetCriteria: false,
  stageMismatch: false,
}

describe('computeForecastConfidence — gating', () => {
  it('phase fermée → indéterminé (ni déclaré ni observé)', () => {
    const r = computeForecastConfidence({ ...BASE, isOpen: false })
    expect(r.verdict).toBe('indéterminé')
    expect(r.declared).toBeNull()
    expect(r.observed).toBeNull()
  })

  it('avancement inconnu → indéterminé', () => {
    expect(
      computeForecastConfidence({ ...BASE, advancement: null }).verdict,
    ).toBe('indéterminé')
  })

  it('engagement non calculable → indéterminé', () => {
    expect(
      computeForecastConfidence({ ...BASE, lastEngagement: null }).verdict,
    ).toBe('indéterminé')
  })
})

describe('computeForecastConfidence — verdicts', () => {
  it('confiance déclarée ≈ engagement → aligné', () => {
    // declared 80, observed 70 → diff 10 < 25.
    expect(computeForecastConfidence(BASE).verdict).toBe('aligné')
  })

  it('CRM confiant + engagement faible → optimiste', () => {
    // declared 80, observed 45 → diff 35 ≥ 25.
    const r = computeForecastConfidence({ ...BASE, lastEngagement: 45 })
    expect(r.verdict).toBe('optimiste')
    expect(r.declared).toBe(80)
    expect(r.observed).toBe(45)
  })

  it('les pénalités (décrochage + critères) creusent l’écart vers optimiste', () => {
    // declared 80, engagement 70 − (15 + 10) = 45 → diff 35 → optimiste.
    const r = computeForecastConfidence({
      ...BASE,
      declining: true,
      unmetCriteria: true,
    })
    expect(r.verdict).toBe('optimiste')
    expect(r.observed).toBe(45)
  })

  it('engagement fort + phase peu avancée → sous-estimé', () => {
    // declared 20, observed 80 → diff −60 ≤ −25.
    const r = computeForecastConfidence({
      ...BASE,
      advancement: 0.2,
      lastEngagement: 80,
    })
    expect(r.verdict).toBe('sous-estimé')
  })

  it('observed planché à 0 (pénalités > engagement)', () => {
    const r = computeForecastConfidence({
      ...BASE,
      lastEngagement: 5,
      declining: true,
      unmetCriteria: true,
      stageMismatch: true,
    })
    expect(r.observed).toBe(0)
  })
})
