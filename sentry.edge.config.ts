/**
 * Config Sentry — runtime Edge (proxy.ts, et certaines routes API si on ajoute
 * `export const runtime = 'edge'`).
 *
 * Importé par instrumentation.ts quand NEXT_RUNTIME === 'edge'.
 */

import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/observability/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // Projet Sentry hébergé en région UE (Allemagne) — cohérent avec Supabase Paris
  // et AssemblyAI EU (données utilisateurs en Europe, cf. AGENTS.md).
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    // Tronque les valeurs longues (une transcription complète ne doit jamais
    // partir en entier dans un message d'erreur). Défaut SDK = 250.
    maxValueLength: 2000,
    // Scrub défense-en-profondeur du contenu d'appel — cf. lib/observability/sentry-scrub.
    beforeSend: scrubEvent,
  });
}
