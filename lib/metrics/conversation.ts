/**
 * Métriques conversationnelles déterministes (J20)
 * -------------------------------------------------
 * Calculées UNIQUEMENT à partir de la diarisation AssemblyAI déjà stockée
 * (`calls.transcript_segments`). Aucun appel IA, aucun coût : du calcul pur.
 *
 * C'est le socle du « radar à problèmes » : un commercial qui monopolise la
 * parole, qui pitche trop tôt, ou un prospect muet sont détectables sans IA.
 *
 * Convention du repo (identique au prompt Claude et à l'affichage du transcript) :
 *   speaker 'A' = COMMERCIAL, speaker 'B' = PROSPECT.
 * La diarisation ne sait pas QUI est qui ; on assume cette convention (le
 * commercial décroche/ouvre en outbound, premier locuteur détecté = 'A').
 * Une passe IA pourra confirmer/corriger les rôles plus tard (J22).
 *
 * Tous les temps sont en MILLISECONDES (comme `start`/`end` des segments).
 */

import type { TranscriptSegment } from '@/lib/assemblyai'

export const COMMERCIAL_SPEAKER = 'A'

/**
 * Seuils d'alerte, nommés et regroupés pour être ajustés facilement après les
 * tests sur les scénarios mock (J25). Ce sont des heuristiques, pas des
 * vérités absolues — d'où des flags séparés de la donnée brute.
 */
export const CONVERSATION_THRESHOLDS = {
  // Un commercial qui parle > 65 % du temps « pitche » au lieu de vendre.
  talkRatioHigh: 0.65,
  // Un prospect qui parle < 25 % du temps est probablement désengagé.
  prospectSilent: 0.25,
  // Pitcher la solution avant 2 min ⇒ découverte bâclée.
  pitchTooEarlyMs: 120_000,
} as const

/**
 * Mots/expressions qui signalent que le commercial passe en mode « présentation
 * de la solution » (et non plus découverte). Heuristique volontairement large
 * mais générique (pas de nom de produit, qui apparaîtrait dès le bonjour).
 * Affinée par l'IA au J22.
 */
const PITCH_KEYWORDS = [
  'notre solution',
  'notre outil',
  'notre plateforme',
  'notre produit',
  'notre logiciel',
  'notre offre',
  'on propose',
  'nous proposons',
  'je vous propose',
  'je vais vous montrer',
  'laissez-moi vous montrer',
  'ce qu’on fait',
  "ce qu'on fait",
  'ce que nous faisons',
  'ça permet de',
  'ça vous permet',
  'vous permet de',
  'permet de',
  'la démo',
  'une démo',
  'fonctionnalité',
  'abonnement',
  'forfait',
  'tarif',
  'pricing',
]

export type ConversationMetrics = {
  commercial_speaker: string
  total_talk_ms: number
  commercial_talk_ms: number
  prospect_talk_ms: number
  // Part de parole du commercial / du prospect sur le temps de parole total.
  // null si l'appel ne contient aucune parole exploitable.
  talk_ratio: number | null
  prospect_talk_ratio: number | null
  // Nombre de « tours de parole » (un tour = une suite ininterrompue de
  // segments d'un même locuteur). Un appel vivant a beaucoup de tours courts ;
  // deux monologues de 5 min = peu de tours = mauvais « ping-pong ».
  turns: number
  avg_turn_ms: number
  // Plus longue tirade ininterrompue du commercial (du début du tour à sa fin).
  longest_monologue_ms: number
  // Moment où le commercial commence à pitcher (heuristique mots-clés). null si
  // jamais détecté.
  jump_to_pitch_ms: number | null
  // Drapeaux d'alerte dérivés des seuils ci-dessus (pour colorer l'UI sans
  // refaire le calcul des seuils côté affichage).
  flags: {
    talk_ratio_high: boolean
    prospect_silent: boolean
    pitch_too_early: boolean
  }
}

/** Durée d'un segment, bornée à 0 (garde contre des timestamps incohérents). */
function segmentDuration(seg: TranscriptSegment): number {
  const d = (seg.end ?? 0) - (seg.start ?? 0)
  return Number.isFinite(d) && d > 0 ? d : 0
}

/**
 * Regroupe les segments consécutifs d'un même locuteur en « tours de parole ».
 * Chaque tour retient le locuteur, le début (start du 1er segment) et la fin
 * (end du dernier) — donc sa durée inclut les micro-silences internes au tour.
 */
function groupTurns(
  segments: TranscriptSegment[],
): Array<{ speaker: string; start: number; end: number }> {
  const turns: Array<{ speaker: string; start: number; end: number }> = []
  for (const seg of segments) {
    const last = turns[turns.length - 1]
    if (last && last.speaker === seg.speaker) {
      last.end = seg.end
    } else {
      turns.push({ speaker: seg.speaker, start: seg.start, end: seg.end })
    }
  }
  return turns
}

/** Détecte le 1er segment commercial qui « pitche » (heuristique mots-clés). */
function detectJumpToPitch(segments: TranscriptSegment[]): number | null {
  for (const seg of segments) {
    if (seg.speaker !== COMMERCIAL_SPEAKER) continue
    const text = (seg.text ?? '').toLowerCase()
    if (PITCH_KEYWORDS.some((kw) => text.includes(kw))) {
      return seg.start
    }
  }
  return null
}

/**
 * Calcule toutes les métriques conversationnelles d'un appel à partir de ses
 * segments diarisés. Fonction pure : mêmes segments → même résultat.
 * Retourne des valeurs neutres (0 / null, flags false) si pas de segments.
 */
export function computeConversationMetrics(
  segments: TranscriptSegment[],
  commercialSpeaker: string = COMMERCIAL_SPEAKER,
): ConversationMetrics {
  const empty: ConversationMetrics = {
    commercial_speaker: commercialSpeaker,
    total_talk_ms: 0,
    commercial_talk_ms: 0,
    prospect_talk_ms: 0,
    talk_ratio: null,
    prospect_talk_ratio: null,
    turns: 0,
    avg_turn_ms: 0,
    longest_monologue_ms: 0,
    jump_to_pitch_ms: null,
    flags: { talk_ratio_high: false, prospect_silent: false, pitch_too_early: false },
  }

  if (!Array.isArray(segments) || segments.length === 0) return empty

  let commercialMs = 0
  let prospectMs = 0
  for (const seg of segments) {
    const d = segmentDuration(seg)
    if (seg.speaker === commercialSpeaker) commercialMs += d
    else prospectMs += d
  }
  const totalMs = commercialMs + prospectMs

  if (totalMs === 0) return empty

  const turns = groupTurns(segments)
  const longestMonologue = turns
    .filter((t) => t.speaker === commercialSpeaker)
    .reduce((max, t) => Math.max(max, t.end - t.start), 0)

  const talkRatio = commercialMs / totalMs
  const prospectTalkRatio = prospectMs / totalMs
  const jumpToPitch = detectJumpToPitch(segments)

  return {
    commercial_speaker: commercialSpeaker,
    total_talk_ms: totalMs,
    commercial_talk_ms: commercialMs,
    prospect_talk_ms: prospectMs,
    talk_ratio: talkRatio,
    prospect_talk_ratio: prospectTalkRatio,
    turns: turns.length,
    avg_turn_ms: Math.round(totalMs / turns.length),
    longest_monologue_ms: longestMonologue,
    jump_to_pitch_ms: jumpToPitch,
    flags: {
      talk_ratio_high: talkRatio > CONVERSATION_THRESHOLDS.talkRatioHigh,
      prospect_silent: prospectTalkRatio < CONVERSATION_THRESHOLDS.prospectSilent,
      pitch_too_early:
        jumpToPitch !== null &&
        jumpToPitch < CONVERSATION_THRESHOLDS.pitchTooEarlyMs,
    },
  }
}
