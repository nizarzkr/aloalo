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
import { searchContactByPhone, createNote, createTask, createEmailDraft } from '@/lib/hubspot'
import { pickAndFillFollowupEmail } from '@/lib/email-templates'
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

  const parts = [
    `Analyse Aloalo — Score global : ${a.score_global}/100`,
    a.summary ? `\n${a.summary}` : '',
    strengths ? `\nPoints forts :\n${strengths}` : '',
    weaknesses ? `\nAxes d'amélioration :\n${weaknesses}` : '',
  ].filter(Boolean)

  return capWords(parts.join('\n'), 200)
}

// Tronque à `max` mots (garde-fou : la spec J16 demande 200 mots max).
function capWords(text: string, max: number): string {
  const words = text.split(/\s+/)
  if (words.length <= max) return text
  return words.slice(0, max).join(' ') + '…'
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
    .select('id, organization_id, status, transcript_text, transcript_segments, callee_number, contact_name')
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
  let analysis
  let usage
  let usedAiProfile = false
  try {
    const result = await analyzeCall(
      call.transcript_text,
      segments,
      aiProfile as AiProfileData | null,
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

  // 8. Automation post-analyse (J17) — en arrière-plan via after().
  //    after() exécute ce travail APRÈS l'envoi de la réponse sans la bloquer ;
  //    Vercel garde la fonction vivante (un fire-and-forget nu serait coupé).
  //
  //    a. Claude choisit + remplit l'email de suivi (modèle de vente) — TOUJOURS,
  //       car c'est utile même sans HubSpot (visible sur la fiche appel Aloalo).
  //    b. Si HubSpot est connecté ET qu'on retrouve le contact par son numéro :
  //       note de synthèse + email brouillon + tâche de follow-up J+2.
  //
  //    Le résultat est persisté dans calls.hubspot_sync_status pour l'afficher
  //    sur /dashboard/calls/[id]. Aucune erreur (HubSpot/Claude down) ne remonte :
  //    tout est try/catch + dégradé, le pipeline d'analyse reste OK quoi qu'il arrive.
  const contactName = (call.contact_name as string | null) ?? null
  const phone = (call.callee_number as string | null) ?? null
  const hubspotToken = (org?.hubspot_token as string | null) ?? null

  after(async () => {
    // Forme du jsonb : cf. migration 0010.
    const sync: Record<string, unknown> = {
      status: 'skipped',
      synced_at: new Date().toISOString(),
    }

    try {
      // a. Email de suivi proposé (indépendant de HubSpot). On le stocke toujours
      //    pour que la valeur démo (« l'IA choisit + remplit votre modèle ») soit
      //    visible côté Aloalo même si le push HubSpot échoue ou est absent.
      const email = await pickAndFillFollowupEmail({ analysis, contactName })
      if (email) {
        sync.template_name = email.templateName
        sync.email_subject = email.subject
        sync.email_body = email.body
      }

      // b. Push HubSpot — uniquement si org connectée + numéro à matcher.
      if (hubspotToken && phone) {
        const contact = await searchContactByPhone(phone, hubspotToken)
        if (!contact) {
          sync.status = 'no_contact'
        } else {
          sync.status = 'synced'
          sync.contact_id = contact.id

          // Note de synthèse (comportement historique J16).
          const noteId = await createNote(
            contact.id,
            buildNoteSummary(analysis),
            hubspotToken,
          )
          if (noteId) sync.note_id = noteId

          // Tâche de follow-up à J+2.
          const dueDateMs = Date.now() + 2 * 24 * 60 * 60 * 1000
          const taskTitle = `Follow-up ${contact.firstname ?? contactName ?? 'prospect'} (appel analysé Aloalo)`
          const taskId = await createTask(contact.id, taskTitle, dueDateMs, hubspotToken)
          if (taskId) sync.task_id = taskId

          // Email de suivi en brouillon sur la fiche contact.
          // ⚠️ hs_email_status="DRAFT" n'est pas garanti par la doc HubSpot ;
          // si le push échoue, email_pushed=false mais l'email proposé reste
          // visible côté Aloalo (email_subject/email_body ci-dessus).
          if (email) {
            const emailId = await createEmailDraft(
              contact.id,
              email.subject,
              email.body,
              hubspotToken,
            )
            sync.email_pushed = Boolean(emailId)
            if (emailId) sync.email_id = emailId
          }

          console.log(
            `[hubspot] synchro post-analyse OK contactId=${contact.id}`,
            `note=${sync.note_id ?? '–'} task=${sync.task_id ?? '–'} email=${sync.email_pushed ? 'oui' : 'non'}`,
          )
        }
      }
    } catch (err) {
      // HubSpot/Claude down ne doit jamais impacter le pipeline d'analyse.
      sync.status = 'error'
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
