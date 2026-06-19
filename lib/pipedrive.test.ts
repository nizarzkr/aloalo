// ============================================================================
// Test unitaire — mapping du tunnel Pipedrive → CrmPipeline (J46). npm test
// ============================================================================
// Fige la fonction PURE mapPipelinesAndStages (aucune I/O) : groupement des
// stages par pipeline, tri par order_nr, conversion de la probabilité 0..100 →
// 0..1, et isClosed=false (Pipedrive n'a pas de stage « fermé », le gagné est un
// statut de deal).
// ============================================================================

import { describe, it, expect } from 'vitest'

import { mapPipelinesAndStages } from '@/lib/pipedrive'

describe('mapPipelinesAndStages', () => {
  it('groupe les stages par pipeline, trie, et mappe la probabilité', () => {
    const pipelines = [
      { id: 1, name: 'Ventes', order_nr: 0 },
      { id: 2, name: 'Onboarding', order_nr: 1 },
    ]
    // Volontairement en désordre pour vérifier le tri par order_nr.
    const stages = [
      { id: 11, name: 'Négociation', pipeline_id: 1, order_nr: 2, deal_probability: 60 },
      { id: 10, name: 'Qualifié', pipeline_id: 1, order_nr: 1, deal_probability: 20 },
      { id: 20, name: 'Kickoff', pipeline_id: 2, order_nr: 1, deal_probability: null },
    ]

    const result = mapPipelinesAndStages(pipelines, stages)

    expect(result).toHaveLength(2)
    const ventes = result[0]
    expect(ventes).toMatchObject({ id: '1', label: 'Ventes', displayOrder: 0 })
    // Stages triés par displayOrder croissant.
    expect(ventes.stages.map((s) => s.id)).toEqual(['10', '11'])
    expect(ventes.stages[0]).toMatchObject({
      id: '10',
      label: 'Qualifié',
      displayOrder: 1,
      isClosed: false,
      probability: 0.2, // 20 / 100
    })
    expect(ventes.stages[1].probability).toBe(0.6)

    // Pipeline 2 : un seul stage, probabilité absente → null.
    const onboarding = result[1]
    expect(onboarding.stages).toHaveLength(1)
    expect(onboarding.stages[0].probability).toBeNull()
    expect(onboarding.stages[0].isClosed).toBe(false)
  })

  it('pipeline sans stage → liste de stages vide', () => {
    const result = mapPipelinesAndStages([{ id: 9, name: 'Vide', order_nr: 0 }], [])
    expect(result).toHaveLength(1)
    expect(result[0].stages).toEqual([])
  })
})
