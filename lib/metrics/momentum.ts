/**
 * Momentum du deal (J23) — trajectoire d'engagement sur plusieurs appels
 * ----------------------------------------------------------------------
 * Là où le J20/J22 analysent UN appel, ici on regarde la SUITE des appels d'un
 * même prospect pour détecter un décrochage : le prospect pose-t-il de moins en
 * moins de questions ? le next step se ramollit-il appel après appel ? Ce sont
 * les « signaux faibles » qui annoncent un deal qui va se perdre.
 *
 * Fonction PURE, calculée à partir de signaux DÉJÀ stockés dans `analyses`
 * (`conversation_metrics` du J20 + `behavioral_signals` du J22) → aucun appel IA,
 * aucun coût. Même logique que `lib/metrics/conversation.ts`.
 *
 * Une branche CRM (off-call : velocity time, multi-threading lus depuis HubSpot)
 * est acceptée en option et n'enrichit que les `reasons[]` si elle est fournie.
 * Elle ne bloque jamais le calcul : sur données simulées (pas d'email réel), elle
 * est simplement absente (cf. mémoire project_hubspot_email_tier_j23).
 */

import type { ConversationMetrics } from '@/lib/metrics/conversation'
import type { BehavioralSignals, NextStepFirmness } from '@/lib/claude'

/**
 * Signaux off-call agrégés au niveau du deal, lus depuis le CRM (HubSpot).
 * Tout est nullable : une donnée indisponible (tier, pas d'email loggué) ne doit
 * jamais faire échouer le momentum, elle est juste omise des raisons.
 */
export type DealCrmSignals = {
  // Délai (heures) entre le 1er email sortant et la 1re réponse entrante du
  // prospect. Plus c'est long, plus le prospect refroidit.
  velocity_hours: number | null
  // Nombre d'interlocuteurs distincts (destinataires + CC) côté prospect.
  // > 1 = multi-threading (DAF, boss en copie) = engagement plus fort.
  multi_threading: number | null
  // Ouvertures / clics cumulés — souvent vides en tier gratuit (non garantis).
  total_opens: number | null
  total_clicks: number | null
}

/**
 * Un point de la trajectoire = les signaux d'UN appel du deal. On ne prend que ce
 * qui sert au momentum (pas tout l'objet analyse).
 */
export type DealCallPoint = {
  call_id: string
  date: string // ISO (started_at ou created_at de l'appel)
  conversation_metrics: ConversationMetrics | null
  behavioral_signals: BehavioralSignals | null
}

export type MomentumTrend = 'hausse' | 'stable' | 'baisse' | 'indéterminé'

/**
 * Code structuré d'un signal de trajectoire. Sert à l'affichage (texte) ET au
 * moteur d'alerte coaching (J24), qui mappe un code → une action 1:1.
 */
export type MomentumSignalCode =
  | 'buying_drop' // moins de signaux d'achat du prospect
  | 'next_step_weaker' // next step qui se ramollit (ferme → mou/absent)
  | 'prospect_quieter' // le prospect parle de moins en moins
  | 'objection_fake' // dernière objection « fausse » (désengagement poli)
  | 'crm_slow_velocity' // délai de réponse email qui s'allonge (off-call)
  | 'crm_mono_thread' // un seul interlocuteur côté prospect (off-call)
  | 'insufficient_data' // pas assez d'appels pour conclure

export type MomentumReason = { code: MomentumSignalCode; text: string }

/**
 * Engagement calculé pour un appel (0-100). C'est un indice INTERNE servant à
 * tracer une courbe et comparer les appels entre eux — surtout PAS une « note »
 * affichée comme telle au commercial (on a justement tué le score sur 100 au J21).
 */
export type DealCallEngagement = {
  call_id: string
  date: string
  engagement: number | null
  // Composantes exposées pour la transparence de l'affichage.
  prospect_talk_ratio: number | null
  buying_signals: number | null
  next_step_firmness: NextStepFirmness | null
}

export type DealMomentum = {
  points: DealCallEngagement[]
  trend: MomentumTrend
  // Raisons structurées de la trajectoire (surtout en cas de baisse) — le
  // « pourquoi » qui nourrira l'alerte coaching du J24 (code + texte affichable).
  reasons: MomentumReason[]
  first_engagement: number | null
  last_engagement: number | null
}

/**
 * Seuils nommés, regroupés pour ajustement après tests sur les mocks (J25).
 * Heuristiques, pas vérités absolues.
 */
export const MOMENTUM_THRESHOLDS = {
  // Variation d'engagement (points sur 100) pour qualifier hausse/baisse.
  engagementDrop: 15,
  engagementRise: 15,
  // Il faut au moins 2 appels exploitables pour parler de « trajectoire ».
  minPointsForTrend: 2,
  // Baisse minimale du talk ratio prospect (points de %) pour la citer comme raison.
  talkRatioDropPct: 0.1,
  // Velocity time (heures) au-delà duquel on alerte sur le refroidissement.
  velocitySlowHours: 48,
} as const

// Mappe la fermeté du next step en score 0-2 (absent < mou < ferme).
function firmnessScore(f: NextStepFirmness | null | undefined): number {
  if (f === 'ferme') return 2
  if (f === 'mou') return 1
  return 0 // 'absent' ou inconnu
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Score d'engagement d'UN appel (0-100), pondéré sur 4 signaux factuels :
 *   - fermeté du next step (0-40) : le signal le plus prédictif d'un deal vivant ;
 *   - signaux d'achat du prospect (0-30) : projections concrètes ;
 *   - temps de parole du prospect (0-20) : un prospect muet décroche ;
 *   - nature de l'objection (0-10) : une vraie objection = engagement, une fausse
 *     (désengagement poli) = signal négatif.
 * Renvoie null si aucun signal exploitable pour cet appel.
 */
function computeCallEngagement(point: DealCallPoint): number | null {
  const bs = point.behavioral_signals
  const cm = point.conversation_metrics
  if (!bs && !cm) return null

  let score = 0

  // Next step (0-40)
  score += firmnessScore(bs?.next_step_firmness) * 20

  // Signaux d'achat (0-30) — plafonnés à 3.
  const buying = bs?.buying_signals?.length ?? 0
  score += (Math.min(buying, 3) / 3) * 30

  // Temps de parole prospect (0-20) — on borne à 0,6 (au-delà, pas « plus » engagé).
  const ptr = cm?.prospect_talk_ratio
  if (ptr != null) {
    score += (clamp(ptr, 0, 0.6) / 0.6) * 20
  }

  // Nature de l'objection (0-10).
  if (bs?.objection_nature === 'vraie') score += 10
  else if (bs?.objection_nature === 'aucune') score += 5
  // 'fausse' → 0

  return Math.round(clamp(score, 0, 100))
}

/**
 * Calcule la trajectoire de momentum d'un deal à partir de ses appels (déjà triés
 * du plus ancien au plus récent). Fonction pure. `crm` est optionnel et n'ajoute
 * que des raisons off-call quand il est fourni et exploitable.
 */
export function computeDealMomentum(
  points: DealCallPoint[],
  crm?: DealCrmSignals | null,
): DealMomentum {
  const engagements: DealCallEngagement[] = (points ?? []).map((p) => ({
    call_id: p.call_id,
    date: p.date,
    engagement: computeCallEngagement(p),
    prospect_talk_ratio: p.conversation_metrics?.prospect_talk_ratio ?? null,
    buying_signals: p.behavioral_signals?.buying_signals?.length ?? null,
    next_step_firmness: p.behavioral_signals?.next_step_firmness ?? null,
  }))

  // On ne raisonne que sur les appels qui ont un engagement calculable.
  const scored = engagements.filter(
    (e): e is DealCallEngagement & { engagement: number } => e.engagement != null,
  )

  const reasons: MomentumReason[] = []

  // Pas assez de matière → on n'invente pas de tendance.
  if (scored.length < MOMENTUM_THRESHOLDS.minPointsForTrend) {
    return {
      points: engagements,
      trend: 'indéterminé',
      reasons: [
        {
          code: 'insufficient_data',
          text:
            scored.length === 0
              ? 'Aucun appel analysé pour ce prospect.'
              : 'Un seul appel analysé — pas encore de trajectoire.',
        },
      ],
      first_engagement: scored[0]?.engagement ?? null,
      last_engagement: scored[scored.length - 1]?.engagement ?? null,
    }
  }

  const firstPoint = scored[0]
  const lastPoint = scored[scored.length - 1]
  const first = firstPoint.engagement
  const last = lastPoint.engagement
  const delta = last - first

  let trend: MomentumTrend = 'stable'
  if (delta <= -MOMENTUM_THRESHOLDS.engagementDrop) trend = 'baisse'
  else if (delta >= MOMENTUM_THRESHOLDS.engagementRise) trend = 'hausse'

  // Raisons in-call : on compare le 1er et le dernier appel exploitables.
  const firstSrc = points.find((p) => p.call_id === firstPoint.call_id)
  const lastSrc = points.find((p) => p.call_id === lastPoint.call_id)

  const buyingFirst = firstSrc?.behavioral_signals?.buying_signals?.length ?? 0
  const buyingLast = lastSrc?.behavioral_signals?.buying_signals?.length ?? 0
  if (buyingLast < buyingFirst) {
    reasons.push({
      code: 'buying_drop',
      text: `Signaux d'achat du prospect : ${buyingFirst} → ${buyingLast}.`,
    })
  }

  const firmFirst = firstSrc?.behavioral_signals?.next_step_firmness
  const firmLast = lastSrc?.behavioral_signals?.next_step_firmness
  if (firmFirst && firmLast && firmnessScore(firmLast) < firmnessScore(firmFirst)) {
    reasons.push({
      code: 'next_step_weaker',
      text: `Prochaine étape : « ${firmFirst} » → « ${firmLast} ».`,
    })
  }

  const ptrFirst = firstSrc?.conversation_metrics?.prospect_talk_ratio
  const ptrLast = lastSrc?.conversation_metrics?.prospect_talk_ratio
  if (
    ptrFirst != null &&
    ptrLast != null &&
    ptrFirst - ptrLast >= MOMENTUM_THRESHOLDS.talkRatioDropPct
  ) {
    reasons.push({
      code: 'prospect_quieter',
      text: `Temps de parole du prospect : ${Math.round(ptrFirst * 100)} % → ${Math.round(ptrLast * 100)} %.`,
    })
  }

  if (
    lastSrc?.behavioral_signals?.objection_nature === 'fausse' &&
    firstSrc?.behavioral_signals?.objection_nature !== 'fausse'
  ) {
    reasons.push({
      code: 'objection_fake',
      text: 'Dernière objection devenue « fausse » (désengagement poli).',
    })
  }

  // Raisons off-call (CRM) — ajoutées seulement si la donnée existe.
  if (crm) {
    if (crm.velocity_hours != null && crm.velocity_hours >= MOMENTUM_THRESHOLDS.velocitySlowHours) {
      reasons.push({
        code: 'crm_slow_velocity',
        text: `Délai de réponse email du prospect : ${Math.round(crm.velocity_hours)} h.`,
      })
    }
    if (crm.multi_threading != null && crm.multi_threading <= 1) {
      reasons.push({
        code: 'crm_mono_thread',
        text: 'Mono-threading : un seul interlocuteur côté prospect (pas de décideur en copie).',
      })
    }
  }

  return {
    points: engagements,
    trend,
    reasons,
    first_engagement: first,
    last_engagement: last,
  }
}
