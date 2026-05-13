/**
 * Next.js 16 — instrumentation hook (server side).
 *
 * Appelé une fois au boot du serveur. On charge la config Sentry du runtime
 * approprié (Node.js par défaut, Edge pour proxy.ts et routes edge).
 *
 * On exporte aussi onRequestError pour capturer automatiquement les erreurs
 * non gérées dans les routes / Server Actions / RSC.
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture automatique des erreurs non catchées dans les route handlers,
// Server Components, Server Actions. Cf. doc Next 16 instrumentation.md.
export const onRequestError = Sentry.captureRequestError;
