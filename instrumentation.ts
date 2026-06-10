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
  // Avertit si le monitoring est désactivé en prod (DSN oublié au déploiement) :
  // sans ça, Sentry no-op silencieusement et on perd toute remontée d'erreurs.
  if (
    (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === "production" &&
    !process.env.NEXT_PUBLIC_SENTRY_DSN
  ) {
    console.warn(
      "[sentry] NEXT_PUBLIC_SENTRY_DSN absent en production — aucune erreur ne sera remontée.",
    );
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Valide les variables d'env requises AVANT toute requête (fail-fast au boot).
    // Si une var manque, le module throw ici → le serveur refuse de démarrer.
    await import("./lib/env");
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture automatique des erreurs non catchées dans les route handlers,
// Server Components, Server Actions. Cf. doc Next 16 instrumentation.md.
export const onRequestError = Sentry.captureRequestError;
