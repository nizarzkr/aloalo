/**
 * Config Sentry — runtime Edge (proxy.ts, et certaines routes API si on ajoute
 * `export const runtime = 'edge'`).
 *
 * Importé par instrumentation.ts quand NEXT_RUNTIME === 'edge'.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
  });
}
