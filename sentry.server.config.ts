/**
 * Config Sentry — runtime Node.js (API routes, Server Components, Server Actions).
 *
 * Importé par instrumentation.ts quand NEXT_RUNTIME === 'nodejs'.
 *
 * DSN public — exposé côté navigateur aussi, par design Sentry (pas un secret).
 * Le secret c'est SENTRY_AUTH_TOKEN, utilisé seulement au build pour uploader
 * les source maps (cf. next.config.ts).
 */

import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/observability/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // Projet Sentry hébergé en région UE (Allemagne) — cohérent avec Supabase Paris
  // et AssemblyAI EU (données utilisateurs en Europe, cf. AGENTS.md).
  Sentry.init({
    dsn,
    // Sampling : 10% des traces en prod, 100% en dev pour debug local.
    // À ajuster à la hausse/baisse quand on aura un baseline trafic.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // L'environment apparaît dans le dashboard Sentry pour filtrer dev/preview/prod.
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Pas de PII (email, IP) — on tag manuellement organization_id si besoin.
    sendDefaultPii: false,
    // Tronque les valeurs longues (une transcription complète ne doit jamais
    // partir en entier dans un message d'erreur). Défaut SDK = 250.
    maxValueLength: 2000,
    // Scrub défense-en-profondeur du contenu d'appel — cf. lib/observability/sentry-scrub.
    beforeSend: scrubEvent,
  });
}
