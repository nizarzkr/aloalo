/**
 * Schémas Zod pour valider les inputs côté serveur.
 *
 * Règle générale : tout ce qui entre dans l'app depuis l'extérieur (formulaire,
 * API route, webhook) DOIT être validé ici avant d'être consommé. Pas de
 * confiance dans le client, jamais.
 *
 * Utilisation côté route :
 *   const parsed = InvitationSchema.safeParse(rawBody)
 *   if (!parsed.success) {
 *     return NextResponse.json(
 *       { error: 'VALIDATION_ERROR', details: parsed.error.issues },
 *       { status: 400 },
 *     )
 *   }
 *   // parsed.data est typé proprement
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// InvitationSchema — POST /api/invitations
// ---------------------------------------------------------------------------
// - email : trim + lowercase + format basique. La vérif "réelle" est faite
//   par Resend à l'envoi, mais on rejette les valeurs manifestement invalides.
// - role : 'manager' | 'sales'. L'owner n'est jamais invité (un owner par org,
//   créé via trigger handle_new_user au signup).
export const InvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'email requis')
    .max(254, 'email trop long') // RFC 5321 / 5322
    .email('email invalide'),
  role: z.enum(['manager', 'sales']),
})

export type InvitationInput = z.infer<typeof InvitationSchema>

// ---------------------------------------------------------------------------
// OrgUpdateSchema — Server Action updateOrganization
// ---------------------------------------------------------------------------
// - name : obligatoire, max 120 chars (limite affichée dans la sidebar / UI).
// - logo_url : optionnel. Vide ('') OU null = on efface le logo en DB.
//   Sinon : http(s) uniquement, max 500 chars. On refuse data:, javascript:,
//   file: etc. (XSS et exfil).
export const OrgUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "nom d'organisation requis")
    .max(120, 'nom max 120 caractères'),
  logo_url: z
    .union([
      z.literal(''),
      z.null(),
      z
        .string()
        .trim()
        .max(500, 'URL max 500 caractères')
        .url('URL invalide')
        .refine(
          (v) => v.startsWith('https://') || v.startsWith('http://'),
          'URL doit commencer par http(s)://',
        ),
    ])
    .optional()
    // Normalisation : '' / undefined / null → null pour la DB.
    .transform((v) => (v && v !== '' ? v : null)),
})

export type OrgUpdateInput = z.infer<typeof OrgUpdateSchema>

// ---------------------------------------------------------------------------
// RingoverApiKeySchema — Server Action updateRingoverApiKey
// ---------------------------------------------------------------------------
// On ne connaît pas le format exact des clés Ringover (et il peut changer).
// On se contente d'un garde-fou : non vide, max 200 chars, pas de whitespace
// interne (les vraies clés sont alphanumeric + tirets).
export const RingoverApiKeySchema = z.object({
  ringover_api_key: z
    .string()
    .trim()
    .min(1, 'clé API requise')
    .max(200, 'clé trop longue (max 200 caractères)')
    .regex(/^\S+$/, 'la clé ne doit pas contenir d\'espaces'),
})

export type RingoverApiKeyInput = z.infer<typeof RingoverApiKeySchema>

// ---------------------------------------------------------------------------
// AiProfileSchema — Server Action updateAiProfile
// ---------------------------------------------------------------------------
// Profil commercial de l'organisation injecté dans le system prompt Claude
// lors de l'analyse d'un appel. Tous les champs sont OPTIONNELS — l'owner
// peut remplir le formulaire en plusieurs fois, et un profil partiel reste
// meilleur qu'aucun profil.
//
// Règles :
//  - chaque champ : string, trim, max 1000 caractères
//  - '' (vide après trim) → null en DB pour ne pas stocker du bruit
//  - Le JSON final stocké dans organizations.ai_profile (jsonb) ne contient
//    QUE les clés non-nulles. Une org sans aucun champ rempli a NULL.
const AiProfileFieldSchema = z
  .union([z.literal(''), z.string().trim().max(1000, 'champ trop long (max 1000 caractères)')])
  .optional()
  .transform((v) => (v && v !== '' ? v : null))

export const AiProfileSchema = z.object({
  activity: AiProfileFieldSchema,
  icp: AiProfileFieldSchema,
  objections: AiProfileFieldSchema,
  offer: AiProfileFieldSchema,
  value_prop: AiProfileFieldSchema,
  competitors: AiProfileFieldSchema,
  methodology: AiProfileFieldSchema,
})

export type AiProfileData = z.infer<typeof AiProfileSchema>

// ---------------------------------------------------------------------------
// ExitCriteriaSchema — Server Action saveExitCriteria (J28)
// ---------------------------------------------------------------------------
// Édition manuelle des critères de sortie d'UNE phase. Le client envoie un
// stageId + une liste de libellés de critères.
//  - stageId : identifiant HubSpot de la phase (non vide).
//  - criteria : 0 à 8 libellés ; chacun trim, 1→200 car. Les libellés vides sont
//    retirés (l'utilisateur peut laisser un champ vide en supprimant un critère).
//    0 critère est valide (l'owner vide volontairement la phase).
export const ExitCriteriaSchema = z.object({
  stageId: z.string().trim().min(1, 'phase manquante').max(100, 'phase invalide'),
  criteria: z
    .array(z.string())
    .max(8, 'maximum 8 critères par phase')
    .transform((arr) =>
      arr
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c.length <= 200),
    ),
})

export type ExitCriteriaInput = z.infer<typeof ExitCriteriaSchema>

// ---------------------------------------------------------------------------
// HubspotSettingsSchema — Server Action updateHubspotSettings (J15)
// ---------------------------------------------------------------------------
// Deux champs, tous deux OPTIONNELS :
//  - hubspot_token : le « Private App token » du client. Vide → null (l'owner
//    n'écrase pas le token existant, comme pour la clé Ringover). Sinon : non
//    vide, max 200 chars, pas d'espace interne (les vrais tokens sont de la
//    forme `pat-eu1-xxxx`). On reste souple sur le format exact.
//  - hubspot_portal_id : le « Hub ID » du portail. Identifiant numérique côté
//    HubSpot. Vide → null. Sinon : chiffres uniquement, max 20 chars.
export const HubspotSettingsSchema = z.object({
  hubspot_token: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .max(200, 'token trop long (max 200 caractères)')
        .regex(/^\S+$/, 'le token ne doit pas contenir d\'espaces'),
    ])
    .optional()
    .transform((v) => (v && v !== '' ? v : null)),
  hubspot_portal_id: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .max(20, 'Portal ID trop long')
        .regex(/^\d+$/, 'le Portal ID ne contient que des chiffres'),
    ])
    .optional()
    .transform((v) => (v && v !== '' ? v : null)),
})

export type HubspotSettingsInput = z.infer<typeof HubspotSettingsSchema>

// ---------------------------------------------------------------------------
// RingoverWebhookSchema — POST /api/webhooks/ringover
// ---------------------------------------------------------------------------
// Forme réelle du payload Ringover (et notre fixture de simulation) :
//   {
//     event: 'call.ended' | autre,
//     organization_id: <uuid Aloalo>,
//     call: {
//       id: <id Ringover>,
//       to_number?: string,
//       duration: number (secondes),
//       recording_url?: string,
//       started_at: string ISO,
//       _sim_transcript?: { ... }   // injecté par /api/dev/simulate-call
//     }
//   }
// On reste TOLÉRANT côté fournisseur : on ne veut pas casser si Ringover
// ajoute un champ. D'où le `.passthrough()` (on garde les champs inconnus)
// et `_sim_transcript` typé en `z.any()` (forme interne, validée ailleurs).
const SimTranscriptSchema = z
  .object({
    text: z.string(),
    segments: z.array(z.unknown()),
    mock_id: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough()

export const RingoverWebhookSchema = z
  .object({
    event: z.string().min(1, 'event requis'),
    organization_id: z.string().uuid('organization_id doit être un uuid'),
    call: z
      .object({
        id: z.string().min(1, 'call.id requis'),
        // Identifiant du compte Ringover (appel réel) : sert à dériver l'org
        // côté serveur sans faire confiance au organization_id du body (issue #8).
        // Absent en simulation (le simulateur fournit l'org via la session).
        account_id: z.string().optional(),
        to_number: z.string().optional(),
        duration: z.number().nonnegative().optional(),
        recording_url: z.string().url().nullable().optional(),
        started_at: z.string().min(1).optional(),
        // Rep propriétaire de l'appel. Renseigné par le simulateur (user connecté).
        // En appel Ringover réel : null pour l'instant (mapping agent→profile à venir).
        user_id: z.string().uuid('user_id doit être un uuid').nullable().optional(),
        _sim_transcript: SimTranscriptSchema.nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough()

export type RingoverWebhookInput = z.infer<typeof RingoverWebhookSchema>

// ---------------------------------------------------------------------------
// SignupSchema / LoginSchema — Server Actions signup & login
// ---------------------------------------------------------------------------
// Validation côté serveur des formulaires d'auth. Le client a un minLength=8
// mais il est contournable (curl/devtools) : on revérifie ici, jamais confiance
// au navigateur.
// - email : trim + lowercase + format (comme InvitationSchema).
// - password (signup) : 8 caractères minimum, garde-fou côté serveur.
//   Au login on ne valide PAS la longueur du mot de passe (on ne veut pas
//   révéler la politique ni distinguer les cas) — juste qu'il est non vide.
export const SignupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'email requis')
    .max(254, 'email trop long')
    .email('email invalide'),
  password: z
    .string()
    .min(8, 'mot de passe : 8 caractères minimum')
    .max(72, 'mot de passe trop long'), // bcrypt tronque au-delà de 72 octets
  full_name: z.string().trim().min(1, 'nom complet requis').max(120, 'nom trop long'),
  organization_name: z
    .string()
    .trim()
    .min(1, "nom d'entreprise requis")
    .max(120, "nom d'entreprise trop long"),
})

export type SignupInput = z.infer<typeof SignupSchema>

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'email requis').max(254, 'email trop long'),
  password: z.string().min(1, 'mot de passe requis'),
})

export type LoginInput = z.infer<typeof LoginSchema>
