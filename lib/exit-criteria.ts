// ============================================================================
// lib/exit-criteria.ts — Génération + persistance des critères de sortie (J28)
// ============================================================================
// Socle #3 (2/3) de la Semaine 4 : pour chaque PHASE OUVERTE du tunnel HubSpot
// (capté en J27), l'IA propose des critères de sortie ; le client les valide /
// ajuste. Consommés en J30 (hygiène de pipeline) pour vérifier sur la
// transcription si un deal mérite d'avancer.
//
// Stockage : colonne jsonb dédiée `organizations.hubspot_exit_criteria`, indexée
// par `id` de phase, SÉPARÉE du snapshot J27 (migration 0026) → survit aux
// re-synchros du tunnel.
//
// Couche IA dans lib/claude.ts (`proposeExitCriteria`) ; lecture des deals
// gagnés dans lib/hubspot.ts (`getRecentWonDeals`). Ici = orchestration + DB.
// ============================================================================

import { randomUUID } from 'node:crypto'

import { createClient as createAdminClient } from '@supabase/supabase-js'

import {
  ANALYSIS_MODEL,
  estimateCostEur,
  proposeExitCriteria,
  type ExitCriteriaStageInput,
} from '@/lib/claude'
import { getRecentWonDeals, type HubspotPipeline } from '@/lib/hubspot'
import type { AiProfileData } from '@/lib/validations'

// Seuil du filet hybride : en dessous, on ne passe PAS les deals gagnés à l'IA
// (échantillon trop maigre pour calibrer quoi que ce soit). La génération
// retombe alors sur libellés + ai_profile → fiable dès le jour 1 (portail vide).
const WON_DEALS_MIN_FOR_CONTEXT = 3

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

// --- Modèle de données (forme du jsonb, cf. migration 0026) -----------------

export type ExitCriterion = {
  id: string // uuid stable → permet à J30 de cocher « rempli / pas rempli »
  label: string
}

export type StageExitCriteria = {
  criteria: ExitCriterion[]
  ai_generated_at: string | null
  edited_at: string | null // non-null = retouché à la main (épargné par « régénérer tout »)
}

// Objet indexé par stageId.
export type ExitCriteriaMap = Record<string, StageExitCriteria>

// --- Lecture ----------------------------------------------------------------

/**
 * Lit la map des critères de sortie d'une org (aucun appel HubSpot ni IA).
 * Sert à l'affichage et, plus tard (J30), à l'hygiène de pipeline.
 */
export async function getOrgExitCriteria(orgId: string): Promise<ExitCriteriaMap> {
  const { data } = await admin()
    .from('organizations')
    .select('hubspot_exit_criteria')
    .eq('id', orgId)
    .maybeSingle()

  return (data?.hubspot_exit_criteria as ExitCriteriaMap | null) ?? {}
}

// --- Helpers internes -------------------------------------------------------

// Extrait les phases OUVERTES (≠ gagné/perdu) de tous les pipelines, à plat,
// dans la forme attendue par le prompt (avec leur rang dans le pipeline).
function openStagesFromPipelines(
  pipelines: HubspotPipeline[],
): ExitCriteriaStageInput[] {
  const out: ExitCriteriaStageInput[] = []
  for (const p of pipelines) {
    const open = p.stages.filter((s) => !s.isClosed)
    open.forEach((s, i) => {
      out.push({
        pipelineLabel: p.label,
        stageId: s.id,
        stageLabel: s.label,
        order: i + 1,
      })
    })
  }
  return out
}

// --- Génération IA ----------------------------------------------------------

export type GenerateExitCriteriaResult =
  | { ok: true; stagesGenerated: number }
  | { ok: false; error: string }

/**
 * Génère (ou régénère) les critères de sortie via l'IA, puis persiste.
 *
 * Filet hybride : toujours depuis libellés de phases + ai_profile ; enrichi par
 * les deals gagnés UNIQUEMENT s'il y en a assez (≥ WON_DEALS_MIN_FOR_CONTEXT).
 *
 * Régénération non destructive : sans `stageIds`, on régénère toutes les phases
 * ouvertes SAUF celles retouchées à la main (`edited_at != null`). Avec
 * `stageIds`, on cible exactement ces phases (y compris pour réécraser une phase
 * éditée — choix explicite de l'utilisateur via le bouton « Régénérer »).
 *
 * @returns nb de phases générées, ou une erreur lisible.
 */
export async function generateOrgExitCriteria(
  orgId: string,
  token: string | null,
  opts: { stageIds?: string[] } = {},
): Promise<GenerateExitCriteriaResult> {
  if (!orgId) return { ok: false, error: 'Organisation introuvable.' }

  const supabase = admin()
  const { data: org } = await supabase
    .from('organizations')
    .select('hubspot_pipelines, ai_profile, hubspot_exit_criteria')
    .eq('id', orgId)
    .maybeSingle()

  const pipelines = (org?.hubspot_pipelines as HubspotPipeline[] | null) ?? []
  if (pipelines.length === 0) {
    return {
      ok: false,
      error: 'Aucun tunnel synchronisé. Synchronisez d’abord le tunnel HubSpot.',
    }
  }

  const aiProfile = (org?.ai_profile as AiProfileData | null) ?? null
  const existing = (org?.hubspot_exit_criteria as ExitCriteriaMap | null) ?? {}

  // Cible : phases ouvertes, filtrées selon le mode (ciblé vs « tout »).
  const allOpen = openStagesFromPipelines(pipelines)
  const targetSet = opts.stageIds ? new Set(opts.stageIds) : null
  const targets = allOpen.filter((s) => {
    if (targetSet) return targetSet.has(s.stageId)
    // Mode « tout » : on épargne UNIQUEMENT les phases éditées à la main QUI ONT
    // ENCORE des critères. Une phase vide (jamais générée, ou vidée par
    // suppression) reste toujours éligible — sinon « Proposer » ne ferait rien
    // une fois toutes les phases vidées.
    const e = existing[s.stageId]
    const hasManualCriteria = e?.edited_at != null && (e.criteria?.length ?? 0) > 0
    return !hasManualCriteria
  })

  if (targets.length === 0) {
    return { ok: false, error: 'Aucune phase à générer.' }
  }

  // Enrichissement optionnel (filet hybride).
  let wonDeals = null
  if (token) {
    const deals = await getRecentWonDeals(token)
    if (deals.length >= WON_DEALS_MIN_FOR_CONTEXT) {
      wonDeals = deals.map((d) => ({ amount: d.amount, closedate: d.closedate }))
    }
  }

  let result
  try {
    result = await proposeExitCriteria(targets, aiProfile, wonDeals)
  } catch (e) {
    console.error('[exit-criteria] génération IA échouée', (e as Error).message)
    return { ok: false, error: 'La génération IA a échoué. Réessayez dans un instant.' }
  }

  const now = new Date().toISOString()
  const next: ExitCriteriaMap = { ...existing }
  let stagesGenerated = 0
  for (const [stageId, labels] of Object.entries(result.criteriaByStage)) {
    next[stageId] = {
      criteria: labels.map((label) => ({ id: randomUUID(), label })),
      ai_generated_at: now,
      edited_at: null, // fraîchement régénéré par l'IA → plus « édité main »
    }
    stagesGenerated += 1
  }

  if (stagesGenerated === 0) {
    return { ok: false, error: 'L’IA n’a proposé aucun critère. Réessayez.' }
  }

  const { error: persistError } = await supabase
    .from('organizations')
    .update({ hubspot_exit_criteria: next })
    .eq('id', orgId)

  if (persistError) {
    console.error('[exit-criteria] persistance échouée', persistError.message)
    return { ok: false, error: 'Enregistrement impossible. Réessayez.' }
  }

  // Log de coût (estimation) — même schéma que /api/analyze, sans call_id.
  const costEur = estimateCostEur(result.usage.input_tokens, result.usage.output_tokens)
  await supabase.from('usage_logs').insert({
    organization_id: orgId,
    service: 'anthropic',
    operation: 'exit_criteria',
    units: result.usage.input_tokens + result.usage.output_tokens,
    cost_eur: costEur,
    metadata: {
      model: ANALYSIS_MODEL,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      stages_generated: stagesGenerated,
      won_deals_used: wonDeals?.length ?? 0,
    },
  })

  return { ok: true, stagesGenerated }
}

// --- Édition manuelle -------------------------------------------------------

/**
 * Remplace les critères d'UNE phase par ceux édités à la main. Régénère les `id`
 * (un libellé reformulé = un nouveau critère côté vérification J30) et marque la
 * phase comme éditée (`edited_at`) → « régénérer tout » ne l'écrasera plus.
 */
export async function saveStageExitCriteria(
  orgId: string,
  stageId: string,
  labels: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (!orgId || !stageId) return { ok: false, error: 'Paramètres manquants.' }

  const supabase = admin()
  const existing = await getOrgExitCriteria(orgId)
  const now = new Date().toISOString()

  const next: ExitCriteriaMap = {
    ...existing,
    [stageId]: {
      criteria: labels.map((label) => ({ id: randomUUID(), label })),
      ai_generated_at: existing[stageId]?.ai_generated_at ?? null,
      edited_at: now,
    },
  }

  const { error } = await supabase
    .from('organizations')
    .update({ hubspot_exit_criteria: next })
    .eq('id', orgId)

  if (error) {
    console.error('[exit-criteria] édition manuelle échouée', error.message)
    return { ok: false, error: 'Enregistrement impossible. Réessayez.' }
  }
  return { ok: true }
}
