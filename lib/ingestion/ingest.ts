// ============================================================================
// lib/ingestion/ingest.ts — Cœur d'ingestion COMMUN à toutes les sources.
// ============================================================================
// En aval des adaptateurs (cf. lib/ingestion/types.ts). Un adaptateur a déjà :
//   - authentifié la requête (HMAC, signature, OAuth selon la source) ;
//   - résolu l'org de façon sûre (jamais depuis un champ non authentifié) ;
//   - (téléphonie) résolu l'URL audio via l'API du provider.
// Ici on fait UNIQUEMENT le travail commun : insérer la ligne calls de façon
// idempotente, puis déclencher la transcription. Aucune logique spécifique à une
// source ne doit vivre dans ce fichier.
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'

import type { NormalizedRecording, IngestResult } from './types'

// Construit la ligne `calls` à insérer à partir d'un enregistrement normalisé.
// Fonction PURE (aucune I/O) → testable unitairement (cf. ingest.test.ts).
// On n'ajoute une colonne optionnelle que si elle a une valeur : les colonnes
// nullables tolèrent l'absence, et idx_calls_user_id tolère user_id NULL.
export function buildCallRow(rec: NormalizedRecording): Record<string, unknown> {
  return {
    organization_id: rec.organizationId,
    provider: rec.provider,
    provider_call_id: rec.providerCallId,
    callee_number: rec.calleeNumber ?? null,
    duration_seconds: rec.durationSeconds,
    audio_url: rec.audioUrl ?? null,
    status: 'pending',
    started_at: rec.startedAt,
    ...(rec.userId ? { user_id: rec.userId } : {}),
    ...(rec.contactName ? { contact_name: rec.contactName } : {}),
    ...(rec.companyName ? { company_name: rec.companyName } : {}),
    ...(rec.dealName ? { deal_name: rec.dealName } : {}),
    ...(rec.dealId ? { deal_id: rec.dealId } : {}),
  }
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

// Ingère un enregistrement normalisé : insertion idempotente + déclenchement de
// la transcription.
//
//   1. INSERT de la ligne `calls` (status 'pending'). L'index unique est PARTIEL
//      (where provider <> 'simulated') → un replay du même provider_call_id réel
//      viole l'index (23505) → on s'arrête en doublon AVANT de relancer une
//      transcription payante (issue #8). Les simulés ont des ids uniques → insert
//      direct, jamais de conflit. NB : on n'utilise PAS ON CONFLICT car Postgres
//      ne peut pas inférer un index partiel sans son prédicat (42P10) et
//      supabase-js ne permet pas de le passer (cf. commit 2097e31).
//   2. Déclenche /api/transcribe dans after() : exécuté APRÈS la réponse au
//      provider, mais Vercel garde la fonction vivante jusqu'au bout (un fetch
//      fire-and-forget nu serait coupé au gel serverless).
//
// @param recording      enregistrement normalisé (org déjà résolue par l'adaptateur)
// @param triggerBaseUrl origine d'où relancer /api/transcribe (req.url côté route)
export async function ingestRecording({
  recording,
  triggerBaseUrl,
}: {
  recording: NormalizedRecording
  triggerBaseUrl: string
}): Promise<IngestResult> {
  const supabase = getAdminClient()
  const isSimulation = recording.provider === 'simulated'

  const { data: insertedCall, error } = await supabase
    .from('calls')
    .insert(buildCallRow(recording))
    .select('id')
    .single()

  // Replay signé d'un appel réel déjà ingéré → doublon, on ignore (idempotence).
  if (error && (error as { code?: string }).code === '23505') {
    console.log('[ingestion] Replay ignoré pour', recording.provider, recording.providerCallId)
    return { outcome: 'duplicate' }
  }

  if (error || !insertedCall) {
    console.error('[ingestion] Erreur insertion:', error)
    Sentry.captureException(error ?? new Error('calls insert returned no row'), {
      tags: { stage: 'ingest_insert_call', provider: recording.provider },
      extra: {
        organizationId: recording.organizationId,
        providerCallId: recording.providerCallId,
      },
    })
    return { outcome: 'error' }
  }

  const callId = insertedCall.id as string
  console.log(
    '[ingestion] Appel inséré ✅',
    recording.provider,
    recording.providerCallId,
    '→ DB id:',
    callId,
  )

  // Déclenche la transcription.
  //   - simulation → on passe le transcript (coût 0, bypass AssemblyAI) ;
  //   - réel → on passe l'audioUrl si déjà résolu, sinon /api/transcribe retombe
  //     sur calls.audio_url (utile pour les retries manuels sans body).
  const transcribeUrl = new URL('/api/transcribe', triggerBaseUrl).toString()
  after(async () => {
    try {
      const res = await fetch(transcribeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-aloalo-internal': process.env.INTERNAL_PIPELINE_SECRET ?? '',
        },
        body: JSON.stringify({
          callId,
          ...(isSimulation && recording.simTranscript
            ? { simTranscript: recording.simTranscript }
            : {}),
          ...(!isSimulation && recording.audioUrl
            ? { audioUrl: recording.audioUrl }
            : {}),
        }),
      })
      if (!res.ok) {
        throw new Error(`/api/transcribe a répondu ${res.status}`)
      }
    } catch (err) {
      console.error('[ingestion] Erreur déclenchement transcription:', err)
      Sentry.captureException(err, {
        tags: { stage: 'ingest_trigger_transcribe', provider: recording.provider },
        extra: { callId, organizationId: recording.organizationId },
      })
    }
  })

  return { outcome: 'inserted', callId }
}
