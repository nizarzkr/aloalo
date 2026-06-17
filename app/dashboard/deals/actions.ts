'use server'

// ============================================================================
// Server Actions — Deals (J26 : « l'alerte qui AGIT »)
// ============================================================================
// `pushCoachingAction` transforme une Alerte Coaching (deal qui décroche) en une
// TÂCHE de suivi créée dans HubSpot, en 1 clic. C'est le patch agentic #2 :
// l'IA passe d'« observer » à « agir ».
//
// Garde-fous (brief J26) :
//   - SERVEUR SOUVERAIN : on ne fait JAMAIS confiance au texte/cible venus du
//     navigateur. On ré-agrège le deal côté serveur et on recompose l'action +
//     la cible à partir de la base. Le client n'envoie que la `group_key`.
//   - IDEMPOTENT : la table `deal_pushed_actions` (unique org+deal+type) empêche
//     un 2ᵉ push. On vérifie avant, et la contrainte rattrape les courses.
//   - TRACÉ : on persiste l'ID de la tâche HubSpot, le texte, qui et quand.
//   - DÉGRADÉ : HubSpot non connecté / en panne → résultat d'erreur lisible,
//     jamais d'exception qui casse la page.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto/org-secrets'
import {
  createTask,
  getMostRecentDealForContact,
  resolveContactContext,
  resolveDueDateMs,
  sanitizeForHubspot,
  type HubspotTarget,
} from '@/lib/hubspot'
import { aggregateOrgDeals } from '@/lib/deals/aggregate'
import type { CoachingAlert } from '@/lib/metrics/coaching-alert'
import { computeDealHygiene } from '@/lib/hygiene/compute'
import { hygieneActionType } from '@/lib/hygiene/rules'
import type { HygieneGap, HygieneGapType } from '@/lib/hygiene/types'

export type PushActionResult =
  | { ok: true; already: boolean }
  | {
      ok: false
      reason:
        | 'unauthorized'
        | 'not_connected'
        | 'no_alert'
        | 'no_gap'
        | 'no_target'
        | 'hubspot_error'
    }

const COACHING_TASK = 'coaching_task'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

// Compose le corps de la tâche HubSpot à partir de l'alerte recalculée :
// l'action 1:1, suivie du « pourquoi » (raisons du décrochage) et de la
// trajectoire d'engagement. Assaini + cappé avant écriture CRM (issue #28).
function buildTaskBody(alert: CoachingAlert): string {
  const reasons = alert.reasons.map((r) => `• ${r.text}`).join('\n')
  const trajectory =
    alert.first_engagement != null && alert.last_engagement != null
      ? `\nEngagement : ${alert.first_engagement} → ${alert.last_engagement} (sur ${alert.calls_count} appels).`
      : ''
  const body = [
    'Alerte Aloalo — engagement du prospect en baisse.',
    `\nAction recommandée :\n${alert.action}`,
    reasons ? `\nPourquoi :\n${reasons}` : '',
    trajectory,
  ]
    .filter(Boolean)
    .join('\n')

  return sanitizeForHubspot(body, 2000, true)
}

// Résout la cible HubSpot (deal en priorité, sinon contact) d'un groupe d'appels.
// Stratégie, du plus fiable au plus coûteux :
//   1. group_key `deal:<id>` → l'ID est déjà l'ID du deal HubSpot.
//   2. deal_id déjà persisté sur un appel du groupe (pas d'appel CRM).
//   3. CONTACT connu mais sans deal stocké → on REDEMANDE à HubSpot en direct
//      s'il existe un deal lié (cas d'un deal créé APRÈS l'enrichissement) ;
//      sinon on cible le contact.
//   4. dernier recours : résolution live complète par numéro.
async function resolveTarget(
  admin: ReturnType<typeof adminClient>,
  orgId: string,
  groupKey: string,
  token: string,
): Promise<HubspotTarget | null> {
  if (groupKey.startsWith('deal:')) {
    const id = groupKey.slice('deal:'.length)
    if (id) return { type: 'deal', id }
  }

  const phone = groupKey.startsWith('phone:')
    ? groupKey.slice('phone:'.length)
    : null

  // Colonnes d'enrichissement déjà persistées sur les appels (pas d'appel CRM).
  const { data: rows } = await admin
    .from('calls')
    .select('deal_id, hubspot_contact_id, created_at')
    .eq('organization_id', orgId)
    .eq(phone ? 'callee_number' : 'deal_id', phone ?? groupKey.slice('deal:'.length))
    .order('created_at', { ascending: false })

  // 2. Deal déjà connu en base → cible directe (cas dominant).
  const storedDealId = (rows ?? []).find((r) => r.deal_id)?.deal_id as
    | string
    | undefined
  if (storedDealId) return { type: 'deal', id: storedDealId }

  // 3. Contact connu sans deal stocké : un deal a pu être créé/associé APRÈS le
  //    dernier enrichissement → on revérifie en direct avant de viser le contact.
  const storedContactId = (rows ?? []).find((r) => r.hubspot_contact_id)
    ?.hubspot_contact_id as string | undefined
  if (storedContactId) {
    const deal = await getMostRecentDealForContact(storedContactId, token)
    if (deal) return { type: 'deal', id: deal.id }
    return { type: 'contact', id: storedContactId }
  }

  // 4. Dernier recours : résolution complète par le numéro (deal d'abord).
  if (phone) {
    const ctx = await resolveContactContext(phone, token)
    if (ctx.deal) return { type: 'deal', id: ctx.deal.id }
    if (ctx.contact) return { type: 'contact', id: ctx.contact.id }
  }

  return null
}

/**
 * Pousse l'alerte coaching d'un deal vers HubSpot sous forme de tâche de suivi.
 * @param groupKey clé de regroupement du deal (`deal:<id>` | `phone:<num>`).
 */
export async function pushCoachingAction(
  groupKey: string,
): Promise<PushActionResult> {
  // 1. Auth + org de l'utilisateur (client serveur respectant la session).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organization_id as string | undefined
  if (!orgId) return { ok: false, reason: 'unauthorized' }

  const admin = adminClient()

  // 2. Idempotence : déjà poussé ? On s'arrête tôt (pas d'appel HubSpot inutile).
  const { data: existing } = await admin
    .from('deal_pushed_actions')
    .select('id')
    .eq('organization_id', orgId)
    .eq('group_key', groupKey)
    .eq('action_type', COACHING_TASK)
    .maybeSingle()
  if (existing) return { ok: true, already: true }

  // 3. Token HubSpot (chiffré au repos, issue #5).
  const { data: org } = await admin
    .from('organizations')
    .select('hubspot_token')
    .eq('id', orgId)
    .maybeSingle()
  const token = decryptSecret((org?.hubspot_token as string | null) ?? null)
  if (!token) return { ok: false, reason: 'not_connected' }

  // 4. Recalcule l'alerte côté serveur (source de vérité — jamais le client).
  const deals = await aggregateOrgDeals(orgId)
  const deal = deals.find((d) => d.group_key === groupKey)
  const alert = deal?.alert
  if (!alert) return { ok: false, reason: 'no_alert' }

  // 5. Cible HubSpot (deal en priorité, sinon contact).
  const target = await resolveTarget(admin, orgId, groupKey, token)
  if (!target) return { ok: false, reason: 'no_target' }

  // 6. Création de la tâche dans HubSpot (réutilise lib/hubspot.createTask).
  const title = sanitizeForHubspot(
    `Aloalo — Relance : ${alert.title}`,
    250,
  )
  const taskId = await createTask(
    target,
    title,
    resolveDueDateMs(null), // J+2 par défaut (relance de suivi).
    token,
    buildTaskBody(alert),
  )
  if (!taskId) return { ok: false, reason: 'hubspot_error' }

  // 7. Trace (idempotence persistée). En cas de course, la contrainte unique
  //    lève une 23505 → on considère que c'est déjà fait, sans planter.
  const { error: insertErr } = await admin.from('deal_pushed_actions').insert({
    organization_id: orgId,
    group_key: groupKey,
    action_type: COACHING_TASK,
    hubspot_object_type: target.type,
    hubspot_object_id: target.id,
    hubspot_task_id: taskId,
    action_text: alert.action,
    pushed_by: user.id,
  })
  if (insertErr && insertErr.code !== '23505') {
    // La tâche EST créée dans HubSpot ; on logge mais on ne signale pas d'échec
    // à l'utilisateur (l'action a bien eu lieu côté CRM).
    console.error('[deals] trace push échouée', insertErr.message)
  }

  // 8. Rafraîchit les surfaces qui montrent l'état « poussé ».
  revalidatePath('/dashboard/deals')
  revalidatePath(`/dashboard/deals/${encodeURIComponent(groupKey)}`)

  return { ok: true, already: false }
}

// ============================================================================
// J31 — Corriger un écart d'hygiène en 1 clic (Pipeline Hygiene Engine 2/2)
// ============================================================================
// Même geste agentic que pushCoachingAction, mais à partir d'un ÉCART d'hygiène
// (J30) : on pousse une TÂCHE de correction dans HubSpot (jamais une mutation de
// phase — non destructif, cf. décision J31). Mêmes garde-fous : serveur souverain
// (on recalcule l'hygiène, on ne fait pas confiance au navigateur), idempotent
// (1 trace par deal + type d'écart), tracé, dégradé proprement.
// ============================================================================

// Compose le corps de la tâche de correction depuis l'écart recalculé : le
// constat, les critères non remplis et l'indice de phase éventuel. Assaini +
// cappé avant écriture CRM (issue #28), comme buildTaskBody.
function buildHygieneTaskBody(gap: HygieneGap): string {
  const criteria =
    gap.unmet_criteria && gap.unmet_criteria.length > 0
      ? `\nCritères de sortie non remplis :\n${gap.unmet_criteria
          .map((c) => `• ${c.label}`)
          .join('\n')}`
      : ''
  const hint = gap.suggested_stage_hint ? `\n${gap.suggested_stage_hint}` : ''
  const body = [
    `Hygiène pipeline Aloalo — ${gap.title}.`,
    `\n${gap.detail}`,
    criteria,
    hint,
  ]
    .filter(Boolean)
    .join('\n')

  return sanitizeForHubspot(body, 2000, true)
}

/**
 * Pousse la correction d'UN écart d'hygiène d'un deal vers HubSpot (tâche).
 * @param groupKey clé du deal (`deal:<id>` | `phone:<num>`).
 * @param gapType  type d'écart à corriger (cf. lib/hygiene/types).
 */
export async function pushHygieneFix(
  groupKey: string,
  gapType: HygieneGapType,
): Promise<PushActionResult> {
  // 1. Auth + org.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organization_id as string | undefined
  if (!orgId) return { ok: false, reason: 'unauthorized' }

  const admin = adminClient()
  const actionType = hygieneActionType(gapType)

  // 2. Idempotence : cet écart précis a-t-il déjà été corrigé ?
  const { data: existing } = await admin
    .from('deal_pushed_actions')
    .select('id')
    .eq('organization_id', orgId)
    .eq('group_key', groupKey)
    .eq('action_type', actionType)
    .maybeSingle()
  if (existing) return { ok: true, already: true }

  // 3. Token HubSpot (chiffré au repos).
  const { data: org } = await admin
    .from('organizations')
    .select('hubspot_token')
    .eq('id', orgId)
    .maybeSingle()
  const token = decryptSecret((org?.hubspot_token as string | null) ?? null)
  if (!token) return { ok: false, reason: 'not_connected' }

  // 4. Recalcule l'hygiène côté serveur (source de vérité — jamais le client)
  //    et retrouve l'écart par son type. Le cache court-circuite (pas de coût IA
  //    si rien n'a bougé depuis le dernier calcul).
  const report = await computeDealHygiene(orgId, groupKey)
  const gap = report?.gaps.find((g) => g.type === gapType)
  if (!gap) return { ok: false, reason: 'no_gap' }

  // 5. Cible HubSpot (deal en priorité, sinon contact) — réutilise resolveTarget.
  const target = await resolveTarget(admin, orgId, groupKey, token)
  if (!target) return { ok: false, reason: 'no_target' }

  // 6. Tâche de correction dans HubSpot.
  const title = sanitizeForHubspot(`Aloalo — Hygiène : ${gap.title}`, 250)
  const taskId = await createTask(
    target,
    title,
    resolveDueDateMs(null), // J+2 par défaut.
    token,
    buildHygieneTaskBody(gap),
  )
  if (!taskId) return { ok: false, reason: 'hubspot_error' }

  // 7. Trace (idempotence persistée). 23505 = course → déjà fait.
  const { error: insertErr } = await admin.from('deal_pushed_actions').insert({
    organization_id: orgId,
    group_key: groupKey,
    action_type: actionType,
    hubspot_object_type: target.type,
    hubspot_object_id: target.id,
    hubspot_task_id: taskId,
    action_text: gap.title,
    pushed_by: user.id,
  })
  if (insertErr && insertErr.code !== '23505') {
    console.error('[deals] trace correction hygiène échouée', insertErr.message)
  }

  // 8. Rafraîchit les surfaces.
  revalidatePath('/dashboard/deals')
  revalidatePath(`/dashboard/deals/${encodeURIComponent(groupKey)}`)
  revalidatePath('/dashboard')

  return { ok: true, already: false }
}

// ============================================================================
// J31 — « Analyser le pipeline » : (re)calcule l'hygiène de tous les deals
// ============================================================================
// Les rapports d'hygiène sont normalement rafraîchis par le pipeline d'analyse
// (J30, after()). Mais les deals analysés AVANT J30 n'en ont pas. Ce déclencheur
// manuel (réservé owner/manager) calcule l'hygiène de chaque deal de l'org. Le
// cache court-circuite ce qui n'a pas bougé → coût IA borné (et nul sur les deals
// sans critères de sortie, ex. données simulées).

export type RefreshHygieneResult =
  | { ok: true; computed: number }
  | { ok: false; reason: 'unauthorized' }

export async function refreshOrgHygiene(): Promise<RefreshHygieneResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organization_id as string | undefined
  const role = profile?.role as string | undefined
  // Action de pilotage : réservée aux owner/manager (un sales ne nettoie pas le
  // pipeline de toute l'équipe).
  if (!orgId || (role !== 'owner' && role !== 'manager')) {
    return { ok: false, reason: 'unauthorized' }
  }

  const deals = await aggregateOrgDeals(orgId)
  let computed = 0
  // Séquentiel : on reste doux avec l'API Anthropic (les passes IA sont rares,
  // seulement pour les phases à critères) et on évite tout pic de concurrence.
  for (const d of deals) {
    const report = await computeDealHygiene(orgId, d.group_key)
    if (report) computed += 1
  }

  revalidatePath('/dashboard/deals')
  revalidatePath('/dashboard')

  return { ok: true, computed }
}
