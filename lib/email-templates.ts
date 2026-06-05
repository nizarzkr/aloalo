/**
 * lib/email-templates.ts — Modèles d'emails de suivi + sélection IA (J17).
 *
 * Idée produit (validée avec Nizar) : plutôt que faire rédiger un email neuf à
 * chaque appel, Aloalo CHOISIT le modèle le plus pertinent parmi des modèles
 * « prêts à l'emploi » et le REMPLIT avec le contexte de l'appel. Le commercial
 * relit puis envoie (jamais d'envoi automatique).
 *
 * Pour le MVP/démo, les modèles sont définis EN DUR ici (DEFAULT_TEMPLATES) :
 *   - ça marche instantanément pour tout nouveau compte (pas de seed DB),
 *   - en V2 on lira les vrais modèles de vente du portail HubSpot du client
 *     (nécessite la Public App + OAuth — cf. roadmap).
 *
 * La sélection + le remplissage sont faits par Claude Haiku via tool use, pour
 * une sortie structurée fiable (template choisi + objet + corps finaux).
 */

import Anthropic from '@anthropic-ai/sdk'
import { ANALYSIS_MODEL } from './claude'
import type { CallAnalysis } from './claude'

// ---------------------------------------------------------------------------
// Modèles de vente par défaut
// ---------------------------------------------------------------------------
// Chaque modèle a :
//   - id : slug stable (sert d'identifiant pour le choix de Claude)
//   - name : libellé FR affiché (« modèle choisi : … »)
//   - whenToUse : aide Claude à choisir le bon modèle selon l'appel
//   - subject / body : trame avec variables {{...}} que Claude remplit.
// Les variables sont indicatives : Claude produit l'objet et le corps FINAUX
// (variables résolues), en gardant la structure et le ton du modèle.

export type EmailTemplate = {
  id: string
  name: string
  whenToUse: string
  subject: string
  body: string
}

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'recap_positif',
    name: 'Récapitulatif & prochaines étapes',
    whenToUse:
      "L'appel s'est bien passé : le prospect est intéressé, une suite concrète est envisageable (démo, proposition, second RDV). Score plutôt bon, next step identifiable.",
    subject: 'Suite à notre échange — {{prochaine_etape}}',
    body: `Bonjour {{prenom}},

Merci pour notre échange. J'ai bien noté {{point_cle}}.

Comme convenu, la prochaine étape est : {{prochaine_etape}}.

Je reste à votre disposition d'ici là.

Bien à vous,`,
  },
  {
    id: 'reponse_objection',
    name: 'Réponse à une objection',
    whenToUse:
      "Le prospect a exprimé une objection ou une réticence (prix, timing, besoin de réfléchir, comparaison concurrent). À utiliser pour lever le doute et garder le contact ouvert.",
    subject: 'Suite à votre point sur {{objection}}',
    body: `Bonjour {{prenom}},

Merci pour votre franchise concernant {{objection}}.

{{element_de_reponse}}

Si cela vous convient, je vous propose {{prochaine_etape}} pour avancer sereinement.

Bien à vous,`,
  },
  {
    id: 'relance_sans_decision',
    name: 'Relance (pas de décision claire)',
    whenToUse:
      "L'appel s'est terminé sans next step clair, ou a été court / interrompu. À utiliser pour relancer et proposer une suite concrète.",
    subject: 'On reprend là où on en était ?',
    body: `Bonjour {{prenom}},

Je reviens vers vous suite à notre échange à propos de {{sujet}}.

Pour avancer concrètement, je vous propose {{prochaine_etape}}.

Dites-moi ce qui vous arrange,

Bien à vous,`,
  },
]

// ---------------------------------------------------------------------------
// Sélection + remplissage par Claude
// ---------------------------------------------------------------------------

export type FollowupEmail = {
  templateId: string
  templateName: string
  subject: string
  body: string
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  return new Anthropic({ apiKey })
}

const SELECT_EMAIL_TOOL: Anthropic.Tool = {
  name: 'select_followup_email',
  description:
    "Choisit le modèle d'email de suivi le plus adapté à l'appel et le remplit. Tu DOIS appeler ce tool une seule fois.",
  input_schema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description:
          "L'id EXACT du modèle choisi parmi la liste fournie (ex: 'recap_positif').",
      },
      subject: {
        type: 'string',
        description:
          "Objet final de l'email, variables résolues. Garder le style du modèle. En français.",
      },
      body: {
        type: 'string',
        description:
          "Corps final de l'email, toutes les variables {{...}} remplacées par le contexte réel de l'appel. Garder la structure et le ton du modèle. Ne JAMAIS inventer de faits absents de l'appel ; si une info manque, rester général plutôt que d'inventer. En français. Ne pas signer avec un nom (le commercial signera).",
      },
    },
    required: ['template_id', 'subject', 'body'],
  },
}

/**
 * Choisit et remplit le modèle d'email de suivi le plus pertinent.
 *
 * @returns le FollowupEmail finalisé, ou null en cas d'échec (l'appelant
 *          dégrade : pas d'email proposé, mais le reste de la synchro continue).
 */
export async function pickAndFillFollowupEmail(params: {
  analysis: CallAnalysis
  contactName: string | null
  templates?: EmailTemplate[]
}): Promise<FollowupEmail | null> {
  const templates = params.templates ?? DEFAULT_TEMPLATES
  if (templates.length === 0) return null

  const { analysis, contactName } = params

  // On donne à Claude un condensé de l'analyse (pas tout le transcript : suffisant
  // pour choisir + personnaliser, et ça borne le coût/latence).
  const strengths = (analysis.strengths ?? []).map((s) => s.point).join(' ; ')
  const weaknesses = (analysis.weaknesses ?? []).map((w) => w.point).join(' ; ')

  const templatesBlock = templates
    .map(
      (t) =>
        `### ${t.id}\nNom : ${t.name}\nQuand l'utiliser : ${t.whenToUse}\nObjet (trame) : ${t.subject}\nCorps (trame) :\n${t.body}`,
    )
    .join('\n\n')

  const userMessage = `Tu rédiges l'email de suivi qu'un commercial enverra après cet appel.

# Contexte de l'appel
Prénom/nom du contact : ${contactName ?? '(inconnu — rester neutre, ex. "Bonjour,")'}
Score global : ${analysis.score_global}/100
Résumé : ${analysis.summary}
Points forts : ${strengths || '(aucun)'}
Axes d'amélioration / points de friction : ${weaknesses || '(aucun)'}

# Modèles disponibles
${templatesBlock}

Choisis LE modèle le plus adapté à la situation, puis remplis-le avec le contexte réel de l'appel (objet + corps finaux, variables {{...}} résolues). Appelle le tool select_followup_email.`

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      tools: [SELECT_EMAIL_TOOL],
      tool_choice: { type: 'tool', name: 'select_followup_email' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (!toolUse) return null

    const input = toolUse.input as {
      template_id?: string
      subject?: string
      body?: string
    }
    if (!input.subject || !input.body) return null

    // Sécurise le template_id : si Claude renvoie un id inconnu, on retombe sur
    // le 1er modèle pour le libellé affiché (le contenu produit reste valable).
    const matched =
      templates.find((t) => t.id === input.template_id) ?? templates[0]

    return {
      templateId: matched.id,
      templateName: matched.name,
      subject: input.subject,
      body: input.body,
    }
  } catch (err) {
    console.error(
      '[email-templates] pickAndFillFollowupEmail a échoué',
      err instanceof Error ? err.message : 'unknown',
    )
    return null
  }
}
