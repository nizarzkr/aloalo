/**
 * Config Sentry — browser (capture les erreurs JS côté client).
 *
 * Importé par instrumentation-client.ts.
 *
 * Important : la variable DOIT être préfixée NEXT_PUBLIC_ pour être accessible
 * côté navigateur. Le DSN Sentry n'est pas un secret (il sert juste à router
 * les events vers le bon projet).
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Replay session : enregistre la session uniquement en cas d'erreur (1 sur 1)
    // et 10% des sessions saines en prod pour debug contextuel.
    // À activer plus tard via integrations Sentry — désactivé pour l'instant
    // pour rester sous les quotas du free tier (50k events/mois).
    integrations: [],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
  });
}
