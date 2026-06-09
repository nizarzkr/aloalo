import { NextRequest } from 'next/server'
import crypto from 'crypto'

const HEADER = 'x-aloalo-internal'

/**
 * Vérifie l'en-tête de secret partagé interne en temps constant.
 * Protège les routes pipeline (service key, bypass RLS) qui ne sont appelées
 * QUE par nos propres webhooks / hops internes — jamais par le front.
 * Retourne false si le secret n'est pas configuré (fail-closed).
 */
export function verifyInternalSecret(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_PIPELINE_SECRET ?? ''
  const provided = req.headers.get(HEADER) ?? ''
  if (!secret || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  // timingSafeEqual exige des longueurs égales : on compare d'abord les tailles.
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export const INTERNAL_HEADER = HEADER
