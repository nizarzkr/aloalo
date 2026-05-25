/**
 * Service d'analyse IA — Claude Haiku 4.5
 *
 * Prend un transcript d'appel commercial (texte brut + segments diarisés)
 * et retourne une analyse structurée alignée sur le schéma de la table `analyses`.
 *
 * On force la sortie JSON via le "tool use" Anthropic : Claude est obligé
 * d'appeler le tool `submit_analysis` avec le schéma exact qu'on attend.
 * Plus fiable qu'un parse de texte brut.
 *
 * Le format de sortie matche directement les colonnes de `analyses` (en anglais)
 * pour qu'on puisse insérer l'objet tel quel sans mapping intermédiaire.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TranscriptSegment } from './assemblyai'
import type { AiProfileData } from './validations'

export const ANALYSIS_MODEL = 'claude-haiku-4-5-20251001'

// ---------------------------------------------------------------------------
// Types — alignés sur les colonnes de la table `analyses`
// ---------------------------------------------------------------------------

export type StrengthOrWeakness = {
  point: string      // libellé court ("Excellente phase de découverte")
  citation: string   // citation EXACTE extraite du transcript
}

export type CoachingAdvice = {
  advice: string                          // conseil concret et actionnable
  priority: 'high' | 'medium' | 'low'
}

/**
 * Forme exacte que Claude doit produire — directement insérable dans `analyses`
 * (à condition d'ajouter call_id, organization_id, cost_eur, model_used côté serveur).
 */
export type CallAnalysis = {
  score_global: number              // 0-100
  score_discovery: number           // 0-100
  score_qualification: number       // 0-100
  score_objection_handling: number  // 0-100
  score_closing: number             // 0-100
  score_next_step: number           // 0-100
  summary: string                   // 2-3 phrases
  strengths: StrengthOrWeakness[]   // max 3
  weaknesses: StrengthOrWeakness[]  // max 3
  coaching_advice: CoachingAdvice[] // max 3
}

export type AnalyzeCallResult = {
  analysis: CallAnalysis
  usage: {
    input_tokens: number
    output_tokens: number
  }
  // true si le profil IA de l'org contenait au moins un champ non-vide et
  // a donc été injecté dans le user message. Le caller persiste ce flag
  // dans analyses.used_ai_profile.
  usedAiProfile: boolean
}

// ---------------------------------------------------------------------------
// Client Anthropic — clé serveur uniquement
// ---------------------------------------------------------------------------

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  return new Anthropic({ apiKey })
}

// ---------------------------------------------------------------------------
// Schéma du tool `submit_analysis` — force le bon JSON
// ---------------------------------------------------------------------------

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_analysis',
  description:
    "Soumet l'analyse structurée de l'appel commercial. Tu DOIS appeler ce tool une seule fois avec tous les champs renseignés.",
  input_schema: {
    type: 'object',
    properties: {
      score_global: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: "Score global de la performance commerciale (0-100). Moyenne pondérée des sous-scores, avec emphase sur closing et next_step.",
      },
      score_discovery: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: "Phase de découverte : questions ouvertes, écoute active, compréhension du contexte, de l'organisation et des enjeux du prospect.",
      },
      score_qualification: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: "Qualification BANT : budget identifié, autorité du décideur confirmée, besoin précis qualifié, timeline claire.",
      },
      score_objection_handling: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: "Traitement des objections : reformulation, réponse argumentée, levée du doute. Pénaliser fort si le commercial évite ou abandonne face à une objection.",
      },
      score_closing: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: "Capacité à engager le prospect vers une décision concrète. Pénaliser fort l'attentisme et les fins d'appel floues.",
      },
      score_next_step: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: "Clarté de la prochaine étape : datée, engageante des deux côtés, avec action concrète. 100 = RDV planifié dans le calendrier, 0 = aucune suite.",
      },
      summary: {
        type: 'string',
        description: "Résumé de l'appel en 2-3 phrases : contexte du prospect, sujet abordé, issue de l'appel.",
      },
      strengths: {
        type: 'array',
        maxItems: 3,
        description: "Jusqu'à 3 points forts du commercial. Chaque point doit s'appuyer sur une citation EXACTE extraite du transcript.",
        items: {
          type: 'object',
          properties: {
            point: {
              type: 'string',
              description: "Libellé court du point fort (ex: 'Excellente reformulation de l'objection prix').",
            },
            citation: {
              type: 'string',
              description: "Citation exacte du transcript qui illustre ce point fort. Recopier mot pour mot.",
            },
          },
          required: ['point', 'citation'],
        },
      },
      weaknesses: {
        type: 'array',
        maxItems: 3,
        description: "Jusqu'à 3 axes de faiblesse, illustrés par une citation exacte du transcript (passage où ça a coincé).",
        items: {
          type: 'object',
          properties: {
            point: {
              type: 'string',
              description: "Libellé court de la faiblesse (ex: 'Pas de question sur le budget').",
            },
            citation: {
              type: 'string',
              description: "Citation exacte du moment problématique. Si la faiblesse est une absence (le commercial n'a pas posé une question), citer le passage où ça aurait dû être posé.",
            },
          },
          required: ['point', 'citation'],
        },
      },
      coaching_advice: {
        type: 'array',
        maxItems: 3,
        description: "Jusqu'à 3 conseils de coaching concrets et actionnables, classés par priorité.",
        items: {
          type: 'object',
          properties: {
            advice: {
              type: 'string',
              description: "Conseil concret à l'impératif (ex: 'Reformuler l'objection prix avant d'y répondre'). Éviter le générique ('mieux gérer les objections').",
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: "high = à corriger en priorité (impact fort sur le taux de closing). medium = important. low = nice-to-have.",
            },
          },
          required: ['advice', 'priority'],
        },
      },
    },
    required: [
      'score_global',
      'score_discovery',
      'score_qualification',
      'score_objection_handling',
      'score_closing',
      'score_next_step',
      'summary',
      'strengths',
      'weaknesses',
      'coaching_advice',
    ],
  },
}

// ---------------------------------------------------------------------------
// Prompt système
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Tu es un expert en analyse d'appels commerciaux B2B francophones. Tu évalues la performance d'un commercial sur un appel de prospection ou de qualification (cible : startups et PME françaises, SaaS).

Ta mission : analyser le transcript fourni et produire une évaluation structurée, factuelle et actionnable.

Cadre d'analyse :
- **Discovery** : questions ouvertes, écoute active, compréhension du contexte / organisation / enjeux.
- **Qualification** : BANT (Budget, Autorité, Besoin, Timeline). Douleurs identifiées.
- **Objection handling** : reformulation, argumentation, levée du doute. Pas d'évitement.
- **Closing** : pousser vers une décision ou un engagement concret. Pas d'attentisme.
- **Next step** : prochaine étape claire, datée, engageante des deux côtés.

Règles strictes :
- Sois factuel : chaque point fort et chaque faiblesse DOIT s'appuyer sur une citation EXACTE du transcript (recopiée mot pour mot).
- Les conseils doivent être concrets et actionnables : "Reformuler l'objection prix avant d'y répondre" plutôt que "Mieux gérer les objections".
- Le speaker A est généralement le commercial, le speaker B le prospect (à confirmer par le contenu).
- Note avec exigence : 70 = bon appel solide, 85+ = excellence rare, 50 = moyen, <40 = appel raté.
- Tu DOIS appeler le tool \`submit_analysis\` une seule fois avec ton analyse complète.`

// Mapping clé technique → libellé français affiché dans le bloc CONTEXTE CLIENT.
// L'ordre des clés ici contrôle l'ordre d'apparition dans le prompt.
const AI_PROFILE_LABELS: Array<[keyof AiProfileData, string]> = [
  ['activity', 'Activité'],
  ['icp', 'Profil client idéal'],
  ['objections', 'Principales objections rencontrées'],
  ['offer', 'Offre principale'],
  ['value_prop', 'Proposition de valeur unique'],
  ['competitors', 'Concurrents directs'],
  ['methodology', 'Méthodologie de vente'],
]

/**
 * Construit le bloc CONTEXTE CLIENT à injecter AVANT le transcript.
 *
 * Retourne null si le profil est null/undefined ou si tous ses champs sont
 * vides — dans ce cas l'analyse tombe sur un prompt générique (comportement
 * historique). Seuls les champs non-vides apparaissent dans le bloc, dans
 * l'ordre de AI_PROFILE_LABELS.
 */
function buildContextBlock(aiProfile: AiProfileData | null | undefined): string | null {
  if (!aiProfile) return null

  const lines: string[] = []
  for (const [key, label] of AI_PROFILE_LABELS) {
    const raw = aiProfile[key]
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (value.length === 0) continue
    lines.push(`${label} : ${value}`)
  }

  if (lines.length === 0) return null

  return `--- CONTEXTE CLIENT ---
${lines.join('\n')}
--- FIN CONTEXTE ---
En tenant compte de ce contexte, analyse l'appel ci-dessous.`
}

function buildUserMessage(
  transcriptText: string,
  segments: TranscriptSegment[],
  aiProfile?: AiProfileData | null,
): { message: string; usedAiProfile: boolean } {
  // On donne d'abord les segments diarisés (plus précis pour identifier qui dit quoi)
  // puis fallback sur le texte brut si pas de segments
  const transcriptBlock = segments.length > 0
    ? segments.map((s) => `[${s.speaker}] ${s.text}`).join('\n')
    : transcriptText

  // Le bloc CONTEXTE est placé AVANT le transcript pour que Claude le lise en
  // premier — l'instruction "en tenant compte de ce contexte" cadre ensuite
  // l'analyse du transcript. Le system prompt reste générique (et donc cache-
  // friendly côté Anthropic) ; le contexte par-org va dans le user message.
  const contextBlock = buildContextBlock(aiProfile)

  const prefix = contextBlock ? `${contextBlock}\n\n` : ''

  const message = `${prefix}Voici le transcript d'un appel commercial à analyser.

# Transcript (avec speakers)
${transcriptBlock}

Analyse cet appel et appelle le tool \`submit_analysis\` avec ton évaluation.`

  return { message, usedAiProfile: contextBlock !== null }
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

export async function analyzeCall(
  transcriptText: string,
  segments: TranscriptSegment[],
  aiProfile?: AiProfileData | null,
): Promise<AnalyzeCallResult> {
  const client = getClient()

  const { message, usedAiProfile } = buildUserMessage(
    transcriptText,
    segments,
    aiProfile,
  )

  const response = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_analysis' },
    messages: [{ role: 'user', content: message }],
  })

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  )

  if (!toolUseBlock || toolUseBlock.name !== 'submit_analysis') {
    throw new Error(
      `Claude n'a pas appelé submit_analysis (stop_reason=${response.stop_reason})`
    )
  }

  return {
    analysis: toolUseBlock.input as CallAnalysis,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    usedAiProfile,
  }
}

// ---------------------------------------------------------------------------
// Coût indicatif Claude Haiku 4.5 — pour usage_logs
// Tarif : 1 USD / 1M input tokens, 5 USD / 1M output tokens
// Conversion : 0.92 EUR/USD (approx)
// ---------------------------------------------------------------------------

export function estimateCostEur(inputTokens: number, outputTokens: number): number {
  const costUsd = (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0
  const costEur = costUsd * 0.92
  return Math.round(costEur * 1_000_000) / 1_000_000  // 6 décimales (= précision colonne cost_eur en DB)
}
