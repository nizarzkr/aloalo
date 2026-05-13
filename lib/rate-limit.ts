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
 * Si les variables UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN ne sont
 * pas définies (ex : dev local sans compte Upstash), on désactive le limiter
 * (fail-open) et on log un warning une seule fois. En prod sur Vercel, les
 * vars doivent être présentes — sinon les routes ne sont pas protégées.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse, type NextRequest } from 'next/server'

let cachedRedis: Redis | null = null
let warnedMissingEnv = false

function getRedis(): Redis | null {
  if (cachedRedis) return cachedRedis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (!warnedMissingEnv) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN absents — rate limiting désactivé',
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
