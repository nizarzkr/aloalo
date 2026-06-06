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

// --- Scoring factuel par dimensions (J21) ---------------------------------
// On n'affiche plus un chiffre /100 mais, par dimension, un statut vérifiable
// + une checklist de critères + une citation qui le prouve.

export type DimensionKey =
  | 'discovery'
  | 'qualification'
  | 'objection_handling'
  | 'closing'
  | 'next_step'

export type DimensionStatus = 'validé' | 'partiel' | 'manqué'

export type DimensionCriterion = {
  label: string   // critère court ("Pain quantifié financièrement")
  met: boolean    // rempli dans l'appel ou non
}

export type DimensionEval = {
  key: DimensionKey
  status: DimensionStatus
  criteria: DimensionCriterion[]
  evidence: string | null   // citation EXACTE qui justifie le statut, ou null
}

// --- Signaux comportementaux (J22) ----------------------------------------
// Lus par l'IA dans le même appel : le SENS de la conversation (intention,
// engagement), en complément des métriques déterministes du J20 (le rythme).

// Réaction du commercial au « trop cher » : creusage (idéal, il questionne) >
// esquive (il évite) > panique (remise immédiate). non_applicable si pas
// d'objection prix.
export type PriceReaction = 'creusage' | 'esquive' | 'panique' | 'non_applicable'

// Après une objection : encaisse (tient le silence, laisse le prospect parler)
// vs comble (remplit le vide, souvent par une remise). non_applicable sinon.
export type SilenceAfterObjection = 'encaisse' | 'comble' | 'non_applicable'

// Fermeté de la prochaine étape côté prospect : ferme (il propose/accepte une
// date précise) / mou (« envoyez une plaquette ») / absent.
export type NextStepFirmness = 'ferme' | 'mou' | 'absent'

// Nature de l'objection principale : vraie (engagement — il veut être
// convaincu) / fausse (désengagement poli) / aucune.
export type ObjectionNature = 'vraie' | 'fausse' | 'aucune'

export type BuyingSignal = {
  quote: string   // citation EXACTE du prospect qui se projette
  label: string   // étiquette courte (ex: "Question d'implémentation")
}

export type BehavioralSignals = {
  // Côté commercial
  open_questions: number
  closed_questions: number
  price_reaction: PriceReaction
  silence_after_objection: SilenceAfterObjection
  // Côté prospect (engagement)
  buying_signals: BuyingSignal[]          // max 5
  next_step_firmness: NextStepFirmness
  objection_nature: ObjectionNature
  objection_quote: string                 // citation de l'objection clé, ou ""
  constructive_interruptions: number
}

/**
 * Tâche de suivi spécifique à l'appel, proposée par l'IA (et non générique).
 * `due_date` est une date absolue AAAA-MM-JJ calculée par Claude à partir de
 * la date de l'appel et des événements mentionnés dedans (réunion interne du
 * prospect, deadline, retour de congés…). Validée/bornée côté serveur avant
 * d'être posée comme tâche HubSpot.
 */
export type SuggestedTask = {
  title: string        // intitulé actionnable et contextuel
  due_date: string     // AAAA-MM-JJ
  reason: string       // pourquoi cette tâche à cette date (appui sur l'appel)
}

/**
 * Forme exacte que Claude doit produire — directement insérable dans `analyses`
 * (à condition d'ajouter call_id, organization_id, cost_eur, model_used côté serveur).
 */
export type CallAnalysis = {
  score_global: number              // 0-100 (conservé pour les agrégats manager, plus affiché sur le détail)
  score_discovery: number           // 0-100
  score_qualification: number       // 0-100
  score_objection_handling: number  // 0-100
  score_closing: number             // 0-100
  score_next_step: number           // 0-100
  dimensions: DimensionEval[]       // scoring factuel affiché sur le détail (J21) — 5 dimensions
  behavioral_signals: BehavioralSignals  // signaux comportementaux IA (J22)
  summary: string                   // 2-3 phrases
  strengths: StrengthOrWeakness[]   // max 3
  weaknesses: StrengthOrWeakness[]  // max 3
  coaching_advice: CoachingAdvice[] // max 3
  followup_points: string[]         // à intégrer dans l'email de suivi (max 6)
  suggested_tasks: SuggestedTask[]  // tâches de suivi datées (max 3)
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
      dimensions: {
        type: 'array',
        description:
          "Évaluation FACTUELLE des 5 dimensions de l'appel. Tu DOIS renvoyer EXACTEMENT 5 objets, un par `key`, dans cet ordre : discovery, qualification, objection_handling, closing, next_step. Pour chaque dimension : un `status` (validé / partiel / manqué), une `criteria` (checklist de 2-3 critères du cadre avec met=true/false), et une `evidence` (citation EXACTE du transcript qui prouve le statut, ou null si la dimension porte sur une ABSENCE — ex. aucune objection traitée, aucun next step posé). Le statut découle des critères : tous remplis = validé, certains = partiel, aucun = manqué.",
        items: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              enum: ['discovery', 'qualification', 'objection_handling', 'closing', 'next_step'],
              description:
                "Dimension évaluée. discovery = découverte (questions ouvertes, contexte, pain quantifié). qualification = BANT (budget, autorité/décideur, besoin, timeline). objection_handling = accueil + reformulation + réponse argumentée aux objections (si AUCUNE objection n'a été soulevée : status='validé', evidence=null). closing = pousser vers une décision/un engagement concret, sans attentisme. next_step = prochaine étape claire, datée précisément, engageante des deux côtés.",
            },
            status: {
              type: 'string',
              enum: ['validé', 'partiel', 'manqué'],
              description: "validé = tous les critères remplis. partiel = certains. manqué = aucun / dimension ratée.",
            },
            criteria: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              description: "2 à 3 critères factuels et concrets propres à la dimension, chacun avec met=true s'il est rempli dans l'appel, false sinon.",
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: "Critère court et factuel (ex: « Pain quantifié financièrement », « Décideur identifié », « RDV daté jour + heure »).",
                  },
                  met: {
                    type: 'boolean',
                    description: "true si le critère est rempli dans l'appel, false sinon.",
                  },
                },
                required: ['label', 'met'],
              },
            },
            evidence: {
              type: 'string',
              description: "Citation EXACTE du transcript (recopiée mot pour mot) qui justifie le statut. Chaîne VIDE si le statut traduit une ABSENCE (rien à citer).",
            },
          },
          required: ['key', 'status', 'criteria', 'evidence'],
        },
      },
      behavioral_signals: {
        type: 'object',
        description:
          "Signaux comportementaux QUALITATIFS lus dans l'appel — deux volets, commercial et prospect. Compte les questions, classe les réactions, cite les signaux d'achat. Sois factuel et n'invente jamais : si un signal n'existe pas, utilise la valeur 'non_applicable' / 'aucune' / 0 / tableau vide.",
        properties: {
          open_questions: {
            type: 'integer',
            minimum: 0,
            description: "Nombre de questions OUVERTES posées par le commercial (qui appellent une réponse développée : « comment… », « pourquoi… », « racontez-moi… »).",
          },
          closed_questions: {
            type: 'integer',
            minimum: 0,
            description: "Nombre de questions FERMÉES posées par le commercial (réponse oui/non ou factuelle courte).",
          },
          price_reaction: {
            type: 'string',
            enum: ['creusage', 'esquive', 'panique', 'non_applicable'],
            description: "Réaction du commercial face à une objection prix (« c'est trop cher »). creusage = il questionne/reformule avant de répondre (idéal). esquive = il évite le sujet. panique = il lâche une remise immédiate. non_applicable = aucune objection prix dans l'appel.",
          },
          silence_after_objection: {
            type: 'string',
            enum: ['encaisse', 'comble', 'non_applicable'],
            description: "Après une objection : encaisse = le commercial tient le silence et laisse le prospect s'exprimer. comble = il remplit le vide immédiatement (souvent par une concession). non_applicable = pas d'objection.",
          },
          buying_signals: {
            type: 'array',
            maxItems: 5,
            description: "Moments où le PROSPECT se projette (signaux d'achat) : questions d'implémentation (« combien de temps pour installer ? », « ça s'intègre avec notre ERP ? »), questions financières/légales (« facturé au mois ou à l'année ? », « conditions de sortie ? »). Tableau vide si aucun.",
            items: {
              type: 'object',
              properties: {
                quote: {
                  type: 'string',
                  description: "Citation EXACTE du prospect, recopiée mot pour mot.",
                },
                label: {
                  type: 'string',
                  description: "Étiquette courte du signal (ex: « Question d'implémentation », « Question tarifaire », « Projection d'usage »).",
                },
              },
              required: ['quote', 'label'],
            },
          },
          next_step_firmness: {
            type: 'string',
            enum: ['ferme', 'mou', 'absent'],
            description: "Engagement du prospect sur la prochaine étape. ferme = il propose ou accepte une date précise (« on se reparle mardi ? »). mou = évasif (« envoyez une plaquette, on vous recontacte »). absent = aucune suite évoquée.",
          },
          objection_nature: {
            type: 'string',
            enum: ['vraie', 'fausse', 'aucune'],
            description: "Nature de l'objection PRINCIPALE du prospect. vraie = signe d'engagement, il cherche à être convaincu (« votre concurrent fait pareil 20 % moins cher, pourquoi vous ? »). fausse = désengagement poli (« super mais pas le temps en ce moment »). aucune = pas d'objection notable.",
          },
          objection_quote: {
            type: 'string',
            description: "Citation EXACTE de l'objection principale du prospect, ou chaîne VIDE si objection_nature = aucune.",
          },
          constructive_interruptions: {
            type: 'integer',
            minimum: 0,
            description: "Nombre de fois où le prospect INTERROMPT le commercial pour creuser/préciser (« attendez, revenez sur l'écran d'avant ») — signe d'engagement fort. 0 si aucune.",
          },
        },
        required: [
          'open_questions',
          'closed_questions',
          'price_reaction',
          'silence_after_objection',
          'buying_signals',
          'next_step_firmness',
          'objection_nature',
          'objection_quote',
          'constructive_interruptions',
        ],
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
      followup_points: {
        type: 'array',
        maxItems: 6,
        description:
          "Points CONCRETS à intégrer dans l'email de suivi que le commercial enverra lui-même. Tu identifies par toi-même ce qui mérite d'y figurer, selon CE que dit l'appel — jamais de point générique. Inclure typiquement : (a) toute information que le prospect a demandée OU que le commercial a promise mais qui n'a PAS été (complètement) fournie pendant l'appel (un prix précis, une disponibilité, un délai, une doc, une référence client) ; (b) les engagements ou décisions pris par le prospect qu'il est utile de rappeler (« doit valider le budget avec son associé », « teste l'outil concurrent cette semaine »). Chaque point = une phrase précise reprenant le détail réel de l'appel (ex: « Communiquer le tarif de l'offre Pro pour 15 utilisateurs, demandé mais non donné »). Tableau vide si l'appel ne contient réellement rien de tel.",
        items: { type: 'string' },
      },
      suggested_tasks: {
        type: 'array',
        maxItems: 3,
        description:
          "0 à 3 tâches de suivi spécifiques à CET appel, déduites de ce qui s'y est réellement dit. INTERDIT : une tâche générique type « relancer le prospect ». Chaque tâche doit refléter une situation précise captée dans l'appel et être datée intelligemment en fonction des événements mentionnés. Exemple : si le prospect dit avoir une réunion avec son manager le 23, propose une tâche « Prendre des nouvelles suite à sa réunion avec son manager » datée au lendemain (le 24). Ne propose une tâche que si elle apporte une vraie valeur ; sinon laisse le tableau vide.",
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description:
                "Intitulé court, actionnable et SPÉCIFIQUE au contexte de l'appel (ex: « Envoyer le devis 15 postes promis » ou « Prendre des nouvelles après sa réunion comité du 23 »). Pas de formulation passe-partout.",
            },
            due_date: {
              type: 'string',
              description:
                "Date d'échéance au format AAAA-MM-JJ. Calcule-la à partir de la DATE DE L'APPEL fournie dans le message et des événements datés mentionnés dans l'appel (réunion interne du prospect, deadline, retour de congés, salon…). Si aucune date précise n'est déductible, propose une échéance raisonnable de 2 à 3 jours ouvrés après l'appel.",
            },
            reason: {
              type: 'string',
              description:
                "Une phrase expliquant POURQUOI cette tâche à cette date précise, en t'appuyant sur ce qui a été dit dans l'appel (donne le contexte au commercial).",
            },
          },
          required: ['title', 'due_date', 'reason'],
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
      'dimensions',
      'behavioral_signals',
      'summary',
      'strengths',
      'weaknesses',
      'coaching_advice',
      'followup_points',
      'suggested_tasks',
    ],
  },
}

// ---------------------------------------------------------------------------
// Prompt système
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Tu es un expert en analyse d'appels commerciaux B2B francophones. Tu évalues la performance d'un commercial sur un appel de prospection ou de qualification (cible : startups et PME françaises, SaaS).

Ta mission : analyser le transcript fourni et produire une évaluation structurée, factuelle et actionnable.

Cadre d'analyse (les 5 dimensions, à évaluer aussi factuellement dans \`dimensions\`) :
- **Discovery** : questions ouvertes, écoute active, compréhension du contexte / organisation / enjeux, pain quantifié (chiffres, temps, argent).
- **Qualification** : BANT (Budget, Autorité/décideur, Besoin, Timeline). Douleurs identifiées.
- **Objection handling** : accueil de l'objection sans évitement, reformulation/creusage, réponse argumentée qui lève le doute. Si AUCUNE objection n'a été soulevée, considère la dimension comme validée (evidence=null).
- **Closing** : pousser vers une décision ou un engagement concret. Pas d'attentisme.
- **Next step** : prochaine étape claire, datée précisément (jour + heure), engageante des deux côtés.

Le scoring chiffré (score_*) sert au pilotage interne. Le scoring FACTUEL (\`dimensions\`) est ce que lit le commercial : pour chaque dimension, un statut (validé/partiel/manqué) justifié par une checklist de critères et une citation exacte. La cohérence entre score et statut est attendue (un score bas ⇒ statut partiel/manqué).

Tu produis aussi des SIGNAUX COMPORTEMENTAUX (\`behavioral_signals\`) — le « radar à problèmes ». Côté commercial : compte les questions ouvertes vs fermées, classe sa réaction à une objection prix (creusage/esquive/panique) et sa tenue du silence après objection (encaisse/comble). Côté prospect (engagement) : repère les signaux d'achat (citations exactes), la fermeté du next step (ferme/mou/absent), la nature vraie/fausse de l'objection, et les interruptions constructives. Reste strictement factuel : si un signal n'existe pas dans l'appel, mets la valeur neutre (non_applicable / aucune / 0 / tableau vide). N'invente jamais une citation.

En plus de l'évaluation, tu produis deux sorties orientées ACTION, propres à cet appel :
- **followup_points** : ce que le commercial doit penser à mettre dans son email de suivi (infos demandées/promises non encore fournies, engagements pris par le prospect). Tu décides toi-même de ce qui mérite d'y figurer, en fonction de ce que dit réellement l'appel.
- **suggested_tasks** : des tâches de relance INTELLIGENTES et datées, déduites du contexte (une réunion interne du prospect, une deadline, un retour de congés…), jamais une relance générique. Sers-toi de la DATE DE L'APPEL fournie dans le message pour calculer des échéances cohérentes.

Règles strictes :
- Sois factuel : chaque point fort et chaque faiblesse DOIT s'appuyer sur une citation EXACTE du transcript (recopiée mot pour mot).
- Les conseils doivent être concrets et actionnables : "Reformuler l'objection prix avant d'y répondre" plutôt que "Mieux gérer les objections".
- followup_points et suggested_tasks doivent être SPÉCIFIQUES à cet appel : reprends les détails réels (montants, noms, dates, produits cités). Bannis le générique. Si l'appel n'en contient pas, laisse le tableau vide plutôt que d'inventer.
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
  callDate?: string | null,
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

  // Date de l'appel = référence pour dater les suggested_tasks. Fallback : la
  // date du jour si non fournie (évite que l'IA invente une référence).
  const dateRef = (callDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10)

  const message = `${prefix}Voici le transcript d'un appel commercial à analyser.

DATE DE L'APPEL : ${dateRef} (sers-toi de cette date comme référence « aujourd'hui » pour calculer les échéances des suggested_tasks).

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
  callDate?: string | null,
): Promise<AnalyzeCallResult> {
  const client = getClient()

  const { message, usedAiProfile } = buildUserMessage(
    transcriptText,
    segments,
    aiProfile,
    callDate,
  )

  const response = await client.messages.create({
    model: ANALYSIS_MODEL,
    // 5120 : marge pour les dimensions (J21) + signaux comportementaux (J22)
    // en plus des forces/faiblesses/coaching/suivi. Éviter toute troncature de
    // la sortie tool_use (qui produirait un JSON invalide).
    max_tokens: 5120,
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
