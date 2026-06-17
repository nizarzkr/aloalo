// ============================================================================
// Test unitaire — Alerte Coaching consciente de la phase (J32)
// ============================================================================
// Comment lancer : npm test
// Vérifie l'ENRICHISSEMENT par la phase : gating sur le décrochage, raisons de
// phase, montée de sévérité en phase avancée / mismatch, action phase-aware.
// ============================================================================

import { describe, it, expect } from 'vitest'

import { buildAlertForDeal, type DealIdentity } from '@/lib/metrics/coaching-alert'
import type { DealMomentum } from '@/lib/metrics/momentum'
import type { DealPhaseContext } from '@/lib/metrics/phase-context'

const DEAL: DealIdentity = {
  group_key: 'deal:1',
  contact_name: 'Marie',
  company_name: 'Acme',
  deal_name: 'Acme — Déploiement',
  owner_name: 'Thomas',
  calls_count: 3,
}

// Décrochage « moyen » (chute modérée, dernier engagement non critique).
const DECLINE_MODERATE: DealMomentum = {
  points: [],
  trend: 'baisse',
  reasons: [{ code: 'buying_drop', text: "Signaux d'achat : 3 → 1." }],
  first_engagement: 70,
  last_engagement: 50,
}

const STABLE: DealMomentum = {
  points: [],
  trend: 'stable',
  reasons: [],
  first_engagement: 60,
  last_engagement: 60,
}

const earlyOpenPhase: DealPhaseContext = {
  stage_label: 'Prise de contact',
  is_open: true,
  advancement: 0.1,
  days_inactive: 2,
  unmet_criteria: [],
  stage_mismatch: false,
}

describe('buildAlertForDeal — gating', () => {
  it('pas d’alerte si le deal ne décroche pas (même avec une phase fournie)', () => {
    expect(buildAlertForDeal(DEAL, STABLE, earlyOpenPhase)).toBeNull()
  })

  it('alerte sans phase : rétro-compatible (stage_label null)', () => {
    const alert = buildAlertForDeal(DEAL, DECLINE_MODERATE)
    expect(alert).not.toBeNull()
    expect(alert?.stage_label).toBeNull()
    expect(alert?.severity).toBe('moyenne')
  })
})

describe('buildAlertForDeal — enrichissement phase', () => {
  it('décrochage en phase avancée ouverte → sévérité « haute »', () => {
    const phase: DealPhaseContext = {
      ...earlyOpenPhase,
      stage_label: 'Négociation',
      advancement: 0.8,
    }
    const alert = buildAlertForDeal(DEAL, DECLINE_MODERATE, phase)
    expect(alert?.severity).toBe('haute')
    expect(alert?.stage_label).toBe('Négociation')
  })

  it('phase ≠ réalité → sévérité « haute » + raison + action de réalignement', () => {
    const phase: DealPhaseContext = {
      ...earlyOpenPhase,
      stage_label: 'Closing',
      stage_mismatch: true,
    }
    const alert = buildAlertForDeal(DEAL, DECLINE_MODERATE, phase)
    expect(alert?.severity).toBe('haute')
    expect(alert?.reasons.some((r) => r.code === 'stage_mismatch')).toBe(true)
    expect(alert?.action).toContain('Closing')
  })

  it('critères de sortie non remplis → raison + action listant les critères', () => {
    const phase: DealPhaseContext = {
      ...earlyOpenPhase,
      stage_label: 'Démo',
      unmet_criteria: ['Budget confirmé'],
    }
    const alert = buildAlertForDeal(DEAL, DECLINE_MODERATE, phase)
    expect(alert?.reasons.some((r) => r.code === 'exit_criteria_gap')).toBe(true)
    expect(alert?.action).toContain('Budget confirmé')
  })

  it('deal figé (inactivité ≥ seuil) en phase ouverte → raison stage_stuck', () => {
    const phase: DealPhaseContext = {
      ...earlyOpenPhase,
      stage_label: 'Démo',
      days_inactive: 30,
    }
    const alert = buildAlertForDeal(DEAL, DECLINE_MODERATE, phase)
    expect(alert?.reasons.some((r) => r.code === 'stage_stuck')).toBe(true)
  })

  it('les raisons de phase précèdent les raisons de momentum', () => {
    const phase: DealPhaseContext = {
      ...earlyOpenPhase,
      stage_label: 'Démo',
      unmet_criteria: ['Budget confirmé'],
    }
    const alert = buildAlertForDeal(DEAL, DECLINE_MODERATE, phase)
    expect(alert?.reasons[0].code).toBe('exit_criteria_gap')
    expect(alert?.reasons.at(-1)?.code).toBe('buying_drop')
  })

  it('phase précoce sans signal → pas de bump, action de momentum conservée', () => {
    const alert = buildAlertForDeal(DEAL, DECLINE_MODERATE, earlyOpenPhase)
    expect(alert?.severity).toBe('moyenne')
    // Aucune raison de phase ajoutée.
    expect(
      alert?.reasons.every((r) => r.code === 'buying_drop'),
    ).toBe(true)
  })
})
