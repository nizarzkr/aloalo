import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// withSentryConfig active le plugin Webpack/Turbopack de Sentry :
//   - tunneling des events Sentry pour bypasser les adblockers
//   - upload des source maps au build (uniquement si SENTRY_AUTH_TOKEN défini)
//
// Sans SENTRY_AUTH_TOKEN, l'upload des source maps est skip silencieusement —
// Sentry reste fonctionnel mais les stack traces ne seront pas mappées en prod.
// Pour configurer le token : Vercel → Settings → Env Vars → SENTRY_AUTH_TOKEN
// (à créer dans Sentry → User Settings → Auth Tokens, scope project:write).
export default withSentryConfig(nextConfig, {
  // Identifiants du projet Sentry — à remplir quand le projet sera créé.
  // En attendant, valeurs vides = aucun warning bloquant.
  org: process.env.SENTRY_ORG ?? "aloalo",
  project: process.env.SENTRY_PROJECT ?? "aloalo-web",

  // Silence les logs du plugin au build local. En CI Vercel, les logs sont
  // utiles pour diagnostiquer un upload de source maps qui échoue.
  silent: !process.env.CI,

  // Désactive l'auto-injection du composant <SentryWebpackPluginInstrumentation/>
  // — on gère nous-mêmes l'init via instrumentation-client.ts.
  autoInstrumentServerFunctions: true,

  // Tunnel route pour bypass les adblockers (les events sont proxyés via notre
  // domaine au lieu d'aller direct sur ingest.sentry.io). Optionnel mais
  // recommandé en MVP B2B où les commerciaux peuvent avoir uBlock.
  tunnelRoute: "/monitoring",

  // Upload des source maps : skip si pas de token (sinon le build casse).
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
