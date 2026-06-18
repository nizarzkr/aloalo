// ============================================================================
// Test unitaire — construction de la ligne `calls` à partir d'un enregistrement
// normalisé (J41). Comment lancer : npm test
// Fige la fonction PURE buildCallRow (aucune I/O) : on vérifie le mapping des
// champs et l'omission des colonnes optionnelles non renseignées.
// ============================================================================

import { describe, it, expect } from 'vitest'

import { buildCallRow } from '@/lib/ingestion/ingest'
import type { NormalizedRecording } from '@/lib/ingestion/types'

const ORG = '00000000-0000-0000-0000-000000000001'

describe('buildCallRow', () => {
  it('appel Ringover réel : colonnes optionnelles absentes', () => {
    const rec: NormalizedRecording = {
      provider: 'ringover',
      providerCallId: 'rg-123',
      organizationId: ORG,
      durationSeconds: 120,
      startedAt: '2026-06-18T10:00:00Z',
      calleeNumber: '+33170000000',
      audioUrl: null,
      userId: null,
      contactName: null,
      companyName: null,
      dealName: null,
      dealId: null,
      simTranscript: null,
    }

    const row = buildCallRow(rec)

    expect(row).toMatchObject({
      organization_id: ORG,
      provider: 'ringover',
      provider_call_id: 'rg-123',
      callee_number: '+33170000000',
      duration_seconds: 120,
      audio_url: null,
      status: 'pending',
      started_at: '2026-06-18T10:00:00Z',
    })
    // Champs optionnels non renseignés → clés absentes (et non null).
    expect(row).not.toHaveProperty('user_id')
    expect(row).not.toHaveProperty('contact_name')
    expect(row).not.toHaveProperty('company_name')
    expect(row).not.toHaveProperty('deal_name')
    expect(row).not.toHaveProperty('deal_id')
  })

  it('appel réel avec audioUrl résolu et user propriétaire', () => {
    const rec: NormalizedRecording = {
      provider: 'ringover',
      providerCallId: 'rg-456',
      organizationId: ORG,
      durationSeconds: 60,
      startedAt: '2026-06-18T11:00:00Z',
      calleeNumber: '+33170000001',
      audioUrl: 'https://cdn.ringover.com/rec/rg-456.mp3',
      userId: '11111111-1111-1111-1111-111111111111',
    }

    const row = buildCallRow(rec)

    expect(row.audio_url).toBe('https://cdn.ringover.com/rec/rg-456.mp3')
    expect(row.user_id).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('appel simulé : identité CRM pré-câblée présente', () => {
    const rec: NormalizedRecording = {
      provider: 'simulated',
      providerCallId: 'sim-789',
      organizationId: ORG,
      durationSeconds: 90,
      startedAt: '2026-06-18T12:00:00Z',
      calleeNumber: null,
      audioUrl: null,
      contactName: 'Julie Lefevre',
      companyName: 'Northwind',
      dealName: 'Northwind — plateforme',
      dealId: 'deal:1',
      simTranscript: { text: 'bonjour', segments: [], duration_seconds: 90 },
    }

    const row = buildCallRow(rec)

    expect(row).toMatchObject({
      provider: 'simulated',
      contact_name: 'Julie Lefevre',
      company_name: 'Northwind',
      deal_name: 'Northwind — plateforme',
      deal_id: 'deal:1',
      callee_number: null,
    })
  })

  it('durationSeconds / startedAt null tolérés (payload incomplet)', () => {
    const rec: NormalizedRecording = {
      provider: 'ringover',
      providerCallId: 'rg-000',
      organizationId: ORG,
      durationSeconds: null,
      startedAt: null,
    }

    const row = buildCallRow(rec)

    expect(row.duration_seconds).toBeNull()
    expect(row.started_at).toBeNull()
    expect(row.callee_number).toBeNull()
    expect(row.audio_url).toBeNull()
  })
})
