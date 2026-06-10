/**
 * Rate limiting via Upstash Redis (@upstash/ratelimit).
 *
 * Deux limiters exposés :
 *   - apiLimiter     : 10 requêtes / 10s — pour les routes API utilisateurs
 *                      (/api/analyze, /api/transcribe, /api/invitations,
 *                      /api/stripe/checkout). Protège contre l'abus côté front.
 *   - webhookLimiter : 100 requêtes / 60s — pour les webhooks providers
 *                      (Ringover, AssemblyAI). Doit absorber des pics legit
 *                      (plusieurs appels qui terminent en même temps).
 *
 * Comportement quand UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN sont
 * absentes :
 *   - En PRODUCTION (Vercel production/preview ou NODE_ENV=production) : on
 *     échoue FORT. getRedis() envoie une alerte Sentry (niveau fatal) puis throw
 *     au cold-start (à l'évaluation du module, via buildLimiter ci-dessous). Un
 *     déploiement mal configuré plante immédiatement et bruyamment au lieu de
 *     servir du trafic avec le rate limiting silencieusement désactivé (sinon
 *     les routes payantes / non authentifiées n'ont plus aucun frein externe).
 *   - En DEV local (sans VERCEL_ENV et NODE_ENV != production) : on tolère le
 *     fail-open — le limiter est désactivé et on log un warning une seule fois,
 *     pour pouvoir bosser sans compte Upstash.
 */

import * as Sentry from '@sentry/nextjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse, type NextRequest } from 'next/server'

let cachedRedis: Redis | null = null
let warnedMissingEnv = false

// True en prod Vercel (production ou preview) OU NODE_ENV=production.
// Mêmes variables que sentry.server.config.ts pour rester cohérent.
function isProductionRuntime(): boolean {
  // `next build` met NODE_ENV=production ET NEXT_PHASE=phase-production-build.
  // Construire n'est PAS servir du trafic : on ne doit pas fail-closed (throw)
  // pendant le build, sinon la CI/Vercel plante à la collecte des données de
  // /api/analyze alors qu'aucune requête n'est servie. Le fail-closed reste
  // intact au vrai cold-start runtime (NEXT_PHASE n'y vaut plus cette valeur).
  if (process.env.NEXT_PHASE === 'phase-production-build') return false
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv) return vercelEnv === 'production' || vercelEnv === 'preview'
  return process.env.NODE_ENV === 'production'
}

function getRedis(): Redis | null {
  if (cachedRedis) return cachedRedis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    // En prod, l'absence des clés Upstash désactiverait silencieusement le
    // rate limiting sur des routes payantes / non authentifiées. On échoue fort
    // (alerte Sentry + throw au cold-start visible) plutôt que fail-open.
    if (isProductionRuntime()) {
      const msg =
        '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN absents en production — rate limiting non disponible'
      Sentry.captureMessage(msg, 'fatal')
      throw new Error(msg)
    }
    // Dev local sans compte Upstash : on tolère le fail-open, mais on le signale.
    if (!warnedMissingEnv) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN absents — rate limiting désactivé (dev uniquement)',
      )
      warnedMissingEnv = true
    }
    return null
  }
  cachedRedis = new Redis({ url, token })
  return cachedRedis
}

function buildLimiter(
  prefix: string,
  limit: number,
  windowSeconds: number,
): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    // Sliding window — comportement plus fluide qu'un fixed window
    // (évite les pics au reset de la fenêtre).
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: `aloalo:${prefix}`,
    analytics: false,
  })
}

export const apiLimiter = buildLimiter('api', 10, 10)
export const webhookLimiter = buildLimiter('webhook', 100, 60)

/**
 * Extrait une clé d'identification pour le rate limiting depuis la requête.
 * Priorité : x-forwarded-for (Vercel), x-real-ip, sinon "anonymous".
 */
export function getClientKey(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'anonymous'
}

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Vérifie le limiter pour une clé donnée. Si le limiter est null (env Upstash
 * manquante), fail-open : on autorise la requête.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<RateLimitDecision> {
  if (!limiter) return { allowed: true }
  const result = await limiter.limit(key)
  if (result.success) return { allowed: true }
  // reset = timestamp ms du prochain créneau dispo
  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
  return { allowed: false, retryAfterSeconds }
}

/**
 * Construit la réponse 429 standard avec Retry-After (en secondes).
 */
export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'rate_limited', retry_after_seconds: retryAfterSeconds },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}
