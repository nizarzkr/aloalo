/**
 * Validation fail-fast des variables d'environnement requises.
 *
 * Importé depuis instrumentation.ts register() : si une variable manque, le
 * serveur refuse de démarrer au cold-start avec UN message qui liste TOUT ce
 * qui manque d'un coup (au lieu de casser plus tard, en silence, au fond d'une
 * requête sur un `process.env.X!` qui valait `undefined`).
 */
import { z } from 'zod'

// Schéma des variables serveur requises. On reflète .env.example.
// min(1) suffit : on veut juste garantir la présence d'une valeur non-vide.
const serverEnvSchema = z.object({
  // Supabase — URL + clés (publishable côté navigateur, secret côté serveur).
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  // Transcription / IA.
  ASSEMBLYAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  // Paiement Stripe — clé API + secret de signature du webhook.
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // Email transactionnel.
  RESEND_API_KEY: z.string().min(1),
  // URL publique de l'app (liens d'invitation, redirections).
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Rate limiting Upstash.
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  // CRM HubSpot — secret de vérification de signature de l'App Card.
  HUBSPOT_APP_CLIENT_SECRET: z.string().min(1),
})

// Exclusions VOLONTAIRES du set requis (pour que le PoC démarre sans elles) :
//   - RINGOVER_WEBHOOK_SECRET / SENTRY_* / HUBSPOT_TOKEN_TEST : l'accès API
//     Ringover est encore « en validation » (cf. AGENTS.md), et les variables
//     Sentry sont build-time / Vercel-only — pas requises pour servir le trafic.
//   - INTERNAL_PIPELINE_SECRET / ASSEMBLYAI_WEBHOOK_SECRET / ORG_SECRETS_ENC_KEY
//     / CRON_SECRET : ces secrets ont DÉJÀ leur propre garde fail-closed au
//     runtime (lib/internal-auth.ts, lib/assemblyai.ts, lib/crypto/org-secrets.ts,
//     /api/cron/*) qui throw / renvoie 401 si absents. Inutile de dupliquer ici.

export type ServerEnv = z.infer<typeof serverEnvSchema>

function loadServerEnv(): ServerEnv {
  // Pendant `next build` (NEXT_PHASE=phase-production-build), on NE valide PAS :
  // construire n'est PAS servir du trafic, et la CI/Vercel build tourne sans
  // secrets (cf. .github/workflows/ci.yml). Le fail-fast reste pleinement actif
  // au vrai cold-start runtime (instrumentation.ts register()), où NEXT_PHASE
  // n'a plus cette valeur. Même garde que lib/rate-limit.ts.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return process.env as unknown as ServerEnv
  }

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    // On liste TOUTES les variables fautives d'un coup pour corriger en un passage.
    const missing = parsed.error.issues
      .map((i) => i.path.join('.'))
      .sort()
      .join(', ')
    throw new Error(
      `[env] Variables d'environnement manquantes ou invalides : ${missing}. ` +
        `Vérifie .env.local (local) ou les Environment Variables Vercel (prod).`,
    )
  }
  return parsed.data
}

// Parse au chargement du module → erreur immédiate au boot si une var manque.
export const env = loadServerEnv()
