/**
 * Next.js 16 — instrumentation client (browser).
 *
 * Exécuté après le chargement du HTML et AVANT l'hydration React. C'est ici
 * qu'on initialise Sentry côté navigateur.
 *
 * On exporte aussi onRouterTransitionStart pour que Sentry instrumente la
 * navigation App Router (utile pour les breadcrumbs).
 */

import * as Sentry from "@sentry/nextjs";

// Init Sentry côté browser (charge la config depuis ./sentry.client.config).
import "./sentry.client.config";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
