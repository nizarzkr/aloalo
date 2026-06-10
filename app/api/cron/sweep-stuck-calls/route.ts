// ============================================================================
// GET /api/cron/sweep-stuck-calls — balayage des appels coincés en transcribing
// ============================================================================
// Filet de sécurité (issue #12) : la transcription d'un vrai appel dépend
// entièrement du webhook « terminé » d'AssemblyAI. Si ce webhook n'arrive jamais
// (NEXT_PUBLIC_APP_URL erroné, échec réseau, cold start au-delà du timeout ~10s
// d'AssemblyAI), l'appel reste en status='transcribing' indéfiniment et le
// spinner client tourne sans fin — rien ne le rattrape.
//
// Ce cron (toutes les 5 min, cf. vercel.json) repère les appels transcribing
// dont updated_at est plus vieux que STUCK_AFTER, tente une dernière
// récupération via getTranscriptionResult, puis à défaut les bascule en
// 'failed' AVEC error_message (le seul moyen de distinguer un appel abandonné
// d'un échec de transcription normal — les chemins d'échec inline ne posent
// pas error_message).
//
// Auth : la route emploie la clé secrète Supabase (bypass RLS) → elle DOIT faire
// sa propre autorisation. On vérifie le CRON_SECRET (Bearer), comme l'edge
// function delete-old-audio. Fail-closed : pas de secret configuré → 401.
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
  getTranscriptionResult,
  normalizeSegments,
  estimateCostEur,
} from '@/lib/assemblyai'

export const dynamic = 'force-dynamic'

// Au-delà de ce délai sans mise à jour, un appel transcribing est considéré coincé.
const STUCK_AFTER_MS = 15 * 60 * 1000

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

// Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> » quand la variable
// d'env CRON_SECRET est configurée sur le projet. On refuse par défaut si elle
// est absente (fail-closed), cohérent avec delete-old-audio.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString()

  // On lit la colonne dédiée assemblyai_transcript_id (indexée) — c'est elle que
  // le webhook utilise pour retrouver le call, PAS transcript_segments.
  const { data: stuck, error } = await supabase
    .from('calls')
    .select('id, organization_id, duration_seconds, assemblyai_transcript_id')
    .eq('status', 'transcribing')
    .lt('updated_at', cutoff)

  if (error) {
    console.error('[sweep-stuck-calls] erreur select:', error)
    return NextResponse.json({ error: 'select_failed' }, { status: 500 })
  }

  let recovered = 0
  let failed = 0

  for (const call of stuck ?? []) {
    const transcriptId = call.assemblyai_transcript_id as string | null

    // Tentative de récupération unique : peut-être que la transcription est
    // prête côté AssemblyAI mais que le webhook s'est perdu.
    if (transcriptId) {
      try {
        const t = await getTranscriptionResult(transcriptId)
        if (t.status === 'completed' && t.text) {
          // Claim atomique transcribing → transcribed (compare-and-set, issue
          // #11) : si le webhook arrive en même temps, un seul des deux gagne et
          // on ne relance ni le log de coût ni l'analyse en double.
          const { data: claimed, error: claimError } = await supabase
            .from('calls')
            .update({
              status: 'transcribed',
              transcript_text: t.text,
              transcript_segments: normalizeSegments(t.utterances),
              audio_url: null, // RGPD : on ne garde pas l'audio
            })
            .eq('id', call.id)
            .eq('status', 'transcribing')
            .select('id')

          if (claimError) {
            console.error('[sweep-stuck-calls] erreur update récup:', claimError)
            continue
          }
          if (!claimed || claimed.length === 0) {
            // Le webhook a gagné la course : rien à faire de plus.
            continue
          }

          // Logger le coût réel comme le fait le webhook (sinon la complétion
          // récupérée par le sweeper n'apparaîtrait jamais dans usage_logs).
          const durationSeconds =
            t.audio_duration ?? call.duration_seconds ?? 0
          await supabase.from('usage_logs').insert({
            organization_id: call.organization_id,
            call_id: call.id,
            service: 'assemblyai',
            operation: 'transcription_completed',
            cost_eur: estimateCostEur(durationSeconds),
            metadata: {
              transcript_id: transcriptId,
              duration_seconds: durationSeconds,
              char_count: t.text.length,
              recovered_by: 'sweep-stuck-calls',
            },
          })

          recovered++

          // Relance l'analyse. On utilise after() (survit au gel serverless,
          // issue #10) et le header interne attendu par /api/analyze (issue #2).
          const appUrl = req.nextUrl.origin
          const callId = call.id
          const organizationId = call.organization_id
          after(async () => {
            try {
              const res = await fetch(`${appUrl}/api/analyze`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-aloalo-internal':
                    process.env.INTERNAL_PIPELINE_SECRET ?? '',
                },
                body: JSON.stringify({ callId }),
              })
              if (!res.ok) {
                throw new Error(`/api/analyze a répondu ${res.status}`)
              }
            } catch (err) {
              console.error('[sweep-stuck-calls] erreur déclenchement /api/analyze:', err)
              Sentry.captureException(err, {
                tags: { route: '/api/cron/sweep-stuck-calls', stage: 'trigger_analyze' },
                extra: { callId, organizationId },
              })
            }
          })
          continue
        }
      } catch (e) {
        console.error('[sweep-stuck-calls] erreur getTranscriptionResult:', e)
        // On retombe sur le failover ci-dessous.
      }
    }

    // Échec : bascule en failed AVEC error_message. Claim atomique pour ne pas
    // écraser un webhook qui viendrait de réussir entre-temps.
    const { data: failedRows, error: failError } = await supabase
      .from('calls')
      .update({
        status: 'failed',
        error_message:
          'Transcription expirée : aucun retour AssemblyAI après 15 min (webhook non reçu).',
      })
      .eq('id', call.id)
      .eq('status', 'transcribing')
      .select('id')

    if (failError) {
      console.error('[sweep-stuck-calls] erreur update failed:', failError)
      continue
    }
    if (failedRows && failedRows.length > 0) failed++
  }

  console.log(
    `[sweep-stuck-calls] ✅ scanné ${stuck?.length ?? 0} (récupérés ${recovered}, échoués ${failed})`,
  )
  return NextResponse.json({
    scanned: stuck?.length ?? 0,
    recovered,
    failed,
  })
}
