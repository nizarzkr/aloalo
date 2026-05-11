/**
 * POST /api/analyze
 *
 * Orchestre l'analyse IA d'un appel déjà transcrit.
 * Appelé en fire-and-forget depuis :
 *   - le webhook AssemblyAI (mode réel) après update status='transcribed'
 *   - /api/transcribe (mode simulation) après insert du transcript
 *
 * Body attendu :
 *   { callId: string }
 *
 * Pipeline :
 *   1. Fetch le call (admin client, bypass RLS)
 *   2. Vérifier status === 'transcribed'
 *   3. Update status → 'analyzing'
 *   4. Appel Claude Haiku via lib/claude
 *   5. Insert dans `analyses` (1-to-1 avec calls)
 *   6. Update calls.status → 'analyzed'
 *   7. Logger dans usage_logs (service='anthropic', tokens, cost_eur)
 *
 * En cas d'erreur Claude : status → 'failed' + error_message en DB.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { analyzeCall, estimateCostEur, ANALYSIS_MODEL } from '@/lib/claude'
import type { TranscriptSegment } from '@/lib/assemblyai'
import { checkUsageLimit, resolveEffectivePlan } from '@/lib/plans'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export async function POST(req: NextRequest) {
  let body: { callId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { callId } = body
  if (!callId) {
    return NextResponse.json({ error: 'callId requis' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // 1. Fetch le call
  const { data: call, error: fetchError } = await supabase
    .from('calls')
    .select('id, organization_id, status, transcript_text, transcript_segments')
    .eq('id', callId)
    .single()

  if (fetchError || !call) {
    console.error('[analyze] Call introuvable:', callId, fetchError)
    return NextResponse.json({ error: 'Call introuvable' }, { status: 404 })
  }

  // 2. Vérifier le status
  if (call.status !== 'transcribed') {
    return NextResponse.json(
      { error: `Status invalide: ${call.status} (attendu 'transcribed')` },
      { status: 400 }
    )
  }

  if (!call.transcript_text) {
    console.error('[analyze] Pas de transcript_text pour call:', callId)
    await supabase.from('calls').update({ status: 'failed', error_message: 'Pas de transcript_text' }).eq('id', callId)
    return NextResponse.json({ error: 'Pas de transcript_text' }, { status: 422 })
  }

  // Les segments sont stockés en jsonb — peuvent être null ou un array
  const segments: TranscriptSegment[] = Array.isArray(call.transcript_segments)
    ? (call.transcript_segments as TranscriptSegment[])
    : []

  // 2bis. Paywall — on bloque AVANT l'appel Claude (sinon on paye pour rien).
  // Le call passe en 'failed' avec un error_message taggé USAGE_LIMIT_REACHED
  // que la page détail saura reconnaître pour afficher la bannière upgrade.
  const { data: org } = await supabase
    .from('organizations')
    .select('subscription_status, subscription_plan')
    .eq('id', call.organization_id)
    .single()

  const plan = resolveEffectivePlan(
    org?.subscription_status ?? null,
    org?.subscription_plan ?? null,
  )

  const usageCheck = await checkUsageLimit(call.organization_id, plan)

  if (!usageCheck.allowed) {
    await supabase
      .from('calls')
      .update({
        status: 'failed',
        error_message: `USAGE_LIMIT_REACHED: ${usageCheck.current}/${usageCheck.limit} (${plan})`,
      })
      .eq('id', callId)

    console.log(
      '[analyze] 🚫 Limite atteinte org:',
      call.organization_id,
      `${usageCheck.current}/${usageCheck.limit} (${plan})`,
    )

    return NextResponse.json(
      {
        error: 'USAGE_LIMIT_REACHED',
        current: usageCheck.current,
        limit: usageCheck.limit,
        plan,
      },
      { status: 402 },
    )
  }

  // 3. Passer en "analyzing"
  await supabase.from('calls').update({ status: 'analyzing' }).eq('id', callId)

  // 4. Appel Claude
  let analysis
  let usage
  try {
    const result = await analyzeCall(call.transcript_text, segments)
    analysis = result.analysis
    usage = result.usage
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analyze] Erreur Claude:', message)
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: `Claude: ${message}` })
      .eq('id', callId)
    return NextResponse.json({ error: 'Claude analysis failed', details: message }, { status: 500 })
  }

  // 5. Calculer le coût + insérer l'analyse
  const costEur = estimateCostEur(usage.input_tokens, usage.output_tokens)

  const { data: inserted, error: insertError } = await supabase
    .from('analyses')
    .insert({
      call_id: callId,
      organization_id: call.organization_id,
      ...analysis,            // score_global, score_discovery, ..., summary, strengths, weaknesses, coaching_advice
      model_used: ANALYSIS_MODEL,
      cost_eur: costEur,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[analyze] Erreur insert analyses:', insertError)
    await supabase
      .from('calls')
      .update({ status: 'failed', error_message: `DB insert: ${insertError?.message}` })
      .eq('id', callId)
    return NextResponse.json({ error: 'DB insert error' }, { status: 500 })
  }

  // 6. Update call → 'analyzed'
  await supabase.from('calls').update({ status: 'analyzed' }).eq('id', callId)

  // 7. Logger dans usage_logs
  await supabase.from('usage_logs').insert({
    organization_id: call.organization_id,
    call_id: callId,
    service: 'anthropic',
    operation: 'analysis',
    units: usage.input_tokens + usage.output_tokens,
    cost_eur: costEur,
    metadata: {
      model: ANALYSIS_MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      score_global: analysis.score_global,
    },
  })

  console.log(
    '[analyze] ✅ Analyse OK call:', callId,
    `score=${analysis.score_global}, tokens=${usage.input_tokens}+${usage.output_tokens}, ${costEur}€`
  )

  return NextResponse.json({ success: true, analysisId: inserted.id })
}
