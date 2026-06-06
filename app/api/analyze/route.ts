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
import { NextRequest, NextResponse, after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { analyzeCall, estimateCostEur, ANALYSIS_MODEL } from '@/lib/claude'
import type { CallAnalysis } from '@/lib/claude'
import { createNote, createTask } from '@/lib/hubspot'
import type { HubspotTarget } from '@/lib/hubspot'
import { enrichCallFromHubspot } from '@/lib/hubspot-sync'
import type { TranscriptSegment } from '@/lib/assemblyai'
import { checkUsageLimit, resolveEffectivePlan } from '@/lib/plans'
import type { AiProfileData } from '@/lib/validations'
import {
  apiLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@/lib/rate-limit'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

/**
 * Résumé court (≤ 200 mots) poussé en note HubSpot après analyse :
 * score global + 3 points forts + 2 axes d'amélioration. On n'utilise que les
 * libellés `point` (pas les citations) pour rester lisible dans la timeline.
 */
function buildNoteSummary(a: CallAnalysis): string {
  const strengths = (a.strengths ?? [])
    .slice(0, 3)
    .map((s) => `• ${s.point}`)
    .join('\n')
  const weaknesses = (a.weaknesses ?? [])
    .slice(0, 2)
    .map((w) => `• ${w.point}`)
    .join('\n')
  // Points à intégrer à l'email de suivi (le cœur de la valeur côté commercial :
  // ce qu'il a promis/qu'on lui a demandé + les engagements du prospect).
  const followups = (a.followup_points ?? [])
    .slice(0, 6)
    .map((p) => `• ${p}`)
    .join('\n')

  const parts = [
    `Analyse Aloalo — Score global : ${a.score_global}/100`,
    a.summary ? `\n${a.summary}` : '',
    strengths ? `\nPoints forts :\n${strengths}` : '',
    weaknesses ? `\nAxes d'amélioration :\n${weaknesses}` : '',
    followups ? `\nÀ intégrer dans l'email de suivi :\n${followups}` : '',
  ].filter(Boolean)

  return capWords(parts.join('\n'), 280)
}

// Tronque à `max` mots (garde-fou contre une note trop longue dans la timeline).
function capWords(text: string, max: number): string {
  const words = text.split(/\s+/)
  if (words.length <= max) return text
  return words.slice(0, max).join(' ') + '…'
}

/**
 * Convertit une date IA (AAAA-MM-JJ) en timestamp ms pour l'échéance HubSpot.
 * Garde-fous : date illisible OU dans le passé → repli à J+2. L'IA peut se
 * tromper de date ; on ne crée jamais une tâche déjà en retard. On fixe l'heure
 * à 08:00 UTC (échéance « matin », l'heure exacte importe peu pour une tâche).
 */
function resolveDueDateMs(dueDate: string | undefined | null): number {
  const fallback = Date.now() + 2 * 24 * 60 * 60 * 1000
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return fallback
  const parsed = new Date(`${dueDate}T08:00:00Z`).getTime()
  if (Number.isNaN(parsed)) return fallback
  // Plancher : demain (une tâche due aujourd'hui/hier n'a pas de sens en relance).
  const minMs = Date.now() + 12 * 60 * 60 * 1000
  return Math.max(parsed, minMs)
}

export async function POST(req: NextRequest) {
  // Rate limit — clé par IP. /api/analyze est appelée en fire-and-forget par les
  // webhooks internes, le limiter protège surtout contre un déclenchement abusif
  // externe.
  const rl = await checkRateLimit(apiLimiter, getClientKey(req))
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds)
  }

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
    .select('id, organization_id, status, transcript_text, transcript_segments, callee_number, contact_name, started_at, created_at')
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
    .select('subscription_status, subscription_plan, ai_profile, hubspot_token, hubspot_portal_id')
    .eq('id', call.organization_id)
    .single()

  const plan = resolveEffectivePlan(
    org?.subscription_status ?? null,
    org?.subscription_plan ?? null,
  )

  // ai_profile est un jsonb → typé `unknown` côté Supabase. On le caste
  // prudemment ; analyzeCall ne lit que les champs string non-vides et
  // ignore le reste, donc une forme partielle ou inattendue ne casse rien.
  const aiProfile =
    (org?.ai_profile as Partial<AiProfileData> | null | undefined) ?? null

  const usageCheck = await checkUsageLimit(call.organization_id, plan)

  if (!usageCheck.allowed) {
    await supabase
      .from('calls')
      .update({
        status: 'failed',
        error_message: `USAGE_LIMIT_REACHED: ${usageCheck.used}/${usageCheck.limit} (${plan})`,
      })
      .eq('id', callId)

    console.log(
      '[analyze] 🚫 Limite atteinte org:',
      call.organization_id,
      `${usageCheck.used}/${usageCheck.limit} (${plan})`,
    )

    return NextResponse.json(
      {
        error: 'USAGE_LIMIT_REACHED',
        used: usageCheck.used,
        limit: usageCheck.limit,
        plan,
      },
      { status: 402 },
    )
  }

  // 3. Passer en "analyzing"
  await supabase.from('calls').update({ status: 'analyzing' }).eq('id', callId)

  // 4. Appel Claude — on passe aiProfile pour contextualiser le prompt si
  //    le profil de l'org est rempli. analyzeCall renvoie usedAiProfile=true
  //    uniquement si au moins un champ non-vide a été injecté.
  // Date de référence pour les tâches datées par l'IA : quand l'appel a eu lieu
  // (started_at), sinon sa création en base. Au format AAAA-MM-JJ.
  const callDate = (
    (call.started_at as string | null) ??
    (call.created_at as string | null) ??
    new Date().toISOString()
  ).slice(0, 10)

  let analysis
  let usage
  let usedAiProfile = false
  try {
    const result = await analyzeCall(
      call.transcript_text,
      segments,
      aiProfile as AiProfileData | null,
      callDate,
    )
    analysis = result.analysis
    usage = result.usage
    usedAiProfile = result.usedAiProfile
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analyze] Erreur Claude:', message)
    Sentry.captureException(err, {
      tags: { route: '/api/analyze', stage: 'claude' },
      extra: { callId, organizationId: call.organization_id },
    })
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
      used_ai_profile: usedAiProfile,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[analyze] Erreur insert analyses:', insertError)
    Sentry.captureException(insertError ?? new Error('analyses insert returned no row'), {
      tags: { route: '/api/analyze', stage: 'db_insert_analyses' },
      extra: { callId, organizationId: call.organization_id },
    })
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
    `score=${analysis.score_global}, tokens=${usage.input_tokens}+${usage.output_tokens}, ${costEur}€, profil=${usedAiProfile ? 'oui' : 'non'}`
  )

  // 8. Automation post-analyse — en arrière-plan via after().
  //    after() exécute ce travail APRÈS l'envoi de la réponse sans la bloquer ;
  //    Vercel garde la fonction vivante (un fire-and-forget nu serait coupé).
  //
  //    Les points de suivi (followup_points) et les tâches contextuelles
  //    (suggested_tasks) sont déjà persistés dans `analyses` (insert ci-dessus)
  //    → visibles côté Aloalo même sans HubSpot.
  //
  //    Si HubSpot est connecté ET qu'on retrouve le contact par son numéro :
  //      - note de synthèse (score + forts/faibles + points de suivi) ;
  //      - 1 tâche HubSpot par suggested_task, datée intelligemment par l'IA
  //        (titre + échéance + contexte), avec repli J+2 si l'IA n'en propose
  //        aucune. Le résultat (ids + libellés + dates) va dans hubspot_sync_status.
  //
  //    Aucune erreur (HubSpot/Claude down) ne remonte : tout est try/catch +
  //    dégradé, le pipeline d'analyse reste OK quoi qu'il arrive.
  const contactName = (call.contact_name as string | null) ?? null
  const phone = (call.callee_number as string | null) ?? null
  const hubspotToken = (org?.hubspot_token as string | null) ?? null

  after(async () => {
    // Forme du jsonb : cf. migrations 0010 / 0011.
    const sync: Record<string, unknown> = {
      status: 'skipped',
      synced_at: new Date().toISOString(),
    }

    try {
      // Push HubSpot — uniquement si org connectée + numéro à matcher.
      if (hubspotToken && phone) {
        // Résout contact + entreprise + deal le plus récent ET enrichit les
        // colonnes d'affichage de l'appel (nom/entreprise/deal visibles dans
        // Aloalo). Réutilise le contexte renvoyé pour cibler la synchro.
        const ctx = await enrichCallFromHubspot(
          supabase,
          callId,
          phone,
          hubspotToken,
        )
        const contact = ctx.contact

        if (!contact) {
          sync.status = 'no_contact'
        } else {
          sync.status = 'synced'
          sync.contact_id = contact.id

          // Cible de la note + des tâches : le deal le plus récent en priorité
          // (l'affaire en cours), sinon repli sur le contact (décision J18bis).
          const target: HubspotTarget = ctx.deal
            ? { type: 'deal', id: ctx.deal.id }
            : { type: 'contact', id: contact.id }
          sync.target = target.type
          if (ctx.deal) {
            sync.deal_id = ctx.deal.id
            sync.deal_name = ctx.deal.dealname ?? null
          }
          if (ctx.company) sync.company_name = ctx.company.name ?? null

          // Note de synthèse (inclut désormais les points à mettre dans le mail).
          // Échec non bloquant : on tente quand même les tâches ensuite.
          try {
            const noteId = await createNote(
              target,
              buildNoteSummary(analysis),
              hubspotToken,
            )
            if (noteId) sync.note_id = noteId
            else sync.note_error = 'createNote a renvoyé null (voir logs)'
          } catch (e) {
            sync.note_error = e instanceof Error ? e.message : 'unknown'
          }

          // Tâches contextuelles proposées par l'IA (max 3). Repli : une tâche
          // J+2 si l'IA n'en a remonté aucune (garde-fou, jamais générique sinon).
          const aiTasks = (analysis.suggested_tasks ?? []).slice(0, 3)
          const tasksToCreate =
            aiTasks.length > 0
              ? aiTasks
              : [
                  {
                    title: `Relancer ${contact.firstname ?? contactName ?? 'le prospect'} suite à l'appel`,
                    due_date: '',
                    reason: 'Relance de suivi par défaut (aucune action datée détectée dans l\'appel).',
                  },
                ]

          // Chaque tâche dans son propre try : une qui échoue n'annule pas les autres.
          const createdTasks: Array<Record<string, unknown>> = []
          for (const t of tasksToCreate) {
            try {
              const dueDateMs = resolveDueDateMs(t.due_date)
              const taskId = await createTask(
                target,
                t.title,
                dueDateMs,
                hubspotToken,
                t.reason,
              )
              createdTasks.push({
                title: t.title,
                due_date: new Date(dueDateMs).toISOString(),
                reason: t.reason,
                task_id: taskId,
                pushed: Boolean(taskId),
              })
            } catch (e) {
              createdTasks.push({
                title: t.title,
                pushed: false,
                error: e instanceof Error ? e.message : 'unknown',
              })
            }
          }
          sync.tasks = createdTasks

          console.log(
            `[hubspot] synchro post-analyse OK contactId=${contact.id}`,
            `cible=${target.type}${ctx.deal ? `(${ctx.deal.id})` : ''}`,
            `note=${sync.note_id ?? '–'} tasks=${createdTasks.filter((t) => t.pushed).length}/${createdTasks.length}`,
          )
        }
      }
    } catch (err) {
      // HubSpot/Claude down ne doit jamais impacter le pipeline d'analyse.
      // On persiste le message pour diagnostic (visible dans hubspot_sync_status).
      sync.status = 'error'
      sync.error = err instanceof Error ? err.message : 'unknown'
      console.error(
        '[analyze] automation post-analyse échouée',
        err instanceof Error ? err.message : 'unknown',
      )
    }

    // Persiste le résultat (best-effort — un échec d'update ne casse rien).
    const { error: syncErr } = await supabase
      .from('calls')
      .update({ hubspot_sync_status: sync })
      .eq('id', callId)
    if (syncErr) {
      console.error('[analyze] update hubspot_sync_status échoué', syncErr.message)
    }
  })

  return NextResponse.json({ success: true, analysisId: inserted.id })
}
